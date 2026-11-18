import doctorModel from '../models/doctorModel.js'
import hospitalModel from '../models/hospitalModel.js'
import userModel from '../models/userModel.js'
import appointmentModel from '../models/appointmentModel.js'
import { approvedDoctorFilter } from '../utils/doctorHelpers.js'

// GET /api/public/stats
// Real numbers from the database, shown on the home page
const getPublicStats = async (req, res) => {
    try {
        const [doctors, hospitals, patients, completedVisits] = await Promise.all([
            doctorModel.countDocuments(approvedDoctorFilter),
            hospitalModel.countDocuments({ verified: true }),
            userModel.countDocuments({ role: { $ne: 'admin' } }),
            appointmentModel.countDocuments({ status: 'Completed' })
        ])

        res.json({ success: true, stats: { doctors, hospitals, patients, completedVisits } })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to load statistics' })
    }
}

export { getPublicStats }
