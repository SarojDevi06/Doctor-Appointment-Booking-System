import userModel from '../models/userModel.js'
import doctorModel from '../models/doctorModel.js'
import hospitalModel from '../models/hospitalModel.js'
import appointmentModel from '../models/appointmentModel.js'
import contactModel from '../models/contactModel.js'
import bcrypt from 'bcryptjs'
import generateToken from '../utils/generateToken.js'
import { cleanEmail } from '../utils/validators.js'
import { getNow, addDays } from '../utils/clinicTime.js'
import { approvedDoctorFilter } from '../utils/doctorHelpers.js'

// The admin is a user whose role is 'admin'.
// The first admin is created with: npm run seed:admin
const adminLogin = async (req, res) => {

    try {

        const { password } = req.body || {}
        const email = cleanEmail(req.body?.email)

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please enter email and password'
            })
        }

        const admin = await userModel.findOne({ email, role: 'admin' })

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            })
        }

        const isMatch = await bcrypt.compare(password, admin.password)

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            })
        }

        // Admin tokens expire sooner than patient tokens
        const token = generateToken(admin._id, 'admin', '1d')

        res.json({
            success: true,
            message: 'Admin login successful',
            token
        })

    } catch (error) {

        console.log(error)

        res.status(500).json({
            success: false,
            message: 'Unable to login. Please try again'
        })
    }
}

// Returns the logged-in admin. The admin panel uses this to check the token.
const getAdminProfile = async (req, res) => {

    try {

        const admin = await userModel
            .findOne({ _id: req.adminId, role: 'admin' })
            .select('name email')

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            })
        }

        res.json({
            success: true,
            admin
        })

    } catch (error) {

        console.log(error)

        res.status(500).json({
            success: false,
            message: 'Unable to load admin profile'
        })
    }
}

// GET /api/admin/dashboard
// Every number comes from the database
const getDashboard = async (req, res) => {
    try {
        const today = getNow().date

        const [patients, doctors, pendingDoctors, hospitals, messages] = await Promise.all([
            userModel.countDocuments({ role: { $ne: 'admin' } }),
            doctorModel.countDocuments(approvedDoctorFilter),
            doctorModel.countDocuments({ approvalStatus: 'pending' }),
            hospitalModel.countDocuments({ verified: true }),
            contactModel.countDocuments()
        ])

        // Appointments (and money) for each status
        const byStatus = await appointmentModel.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }
        ])

        const statusCounts = { Pending: 0, Confirmed: 0, Rejected: 0, Completed: 0, Cancelled: 0, 'No-Show': 0 }
        let revenue = 0

        byStatus.forEach((row) => {
            statusCounts[row._id] = row.count
            if (row._id === 'Completed') revenue = row.amount
        })

        const totalAppointments = Object.values(statusCounts).reduce((sum, number) => sum + number, 0)

        // Appointments per day for the last 7 days
        const startDate = addDays(today, -6)

        const perDay = await appointmentModel.aggregate([
            { $match: { date: { $gte: startDate, $lte: today } } },
            { $group: { _id: '$date', count: { $sum: 1 } } }
        ])

        const chart = []

        for (let i = 6; i >= 0; i--) {
            const date = addDays(today, -i)
            const found = perDay.find(row => row._id === date)
            chart.push({ date, count: found ? found.count : 0 })
        }

        // Doctors with the most completed visits
        const topRows = await appointmentModel.aggregate([
            { $match: { status: 'Completed' } },
            { $group: { _id: '$doctorId', completed: { $sum: 1 } } },
            { $sort: { completed: -1 } },
            { $limit: 5 }
        ])

        const topDoctorDocs = await doctorModel
            .find({ _id: { $in: topRows.map(row => row._id) } })
            .select('name speciality')

        const topDoctors = topRows.map((row) => {
            const doctor = topDoctorDocs.find(item => String(item._id) === String(row._id))

            return {
                doctorId: row._id,
                name: doctor ? doctor.name : 'Removed doctor',
                speciality: doctor ? doctor.speciality : '',
                completed: row.completed
            }
        })

        const recentAppointments = await appointmentModel
            .find()
            .sort({ createdAt: -1 })
            .limit(6)
            .populate('userId', 'name')
            .populate('doctorId', 'name speciality')

        res.json({
            success: true,
            stats: {
                patients,
                doctors,
                pendingDoctors,
                hospitals,
                messages,
                totalAppointments,
                revenue,
                statusCounts
            },
            chart,
            topDoctors,
            recentAppointments
        })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to load dashboard' })
    }
}

export { adminLogin, getAdminProfile, getDashboard }
