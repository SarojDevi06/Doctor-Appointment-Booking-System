import doctorModel from '../models/doctorModel.js'
import bcrypt from 'bcryptjs'
import generateToken from '../utils/generateToken.js'
import {
    cleanEmail,
    isValidEmail,
    isValidPassword
} from '../utils/validators.js'


const getDoctors = async (req, res) => {
    try {
        const doctors = await doctorModel
            .find({ available: true })
            .select('-password')

        return res.status(200).json({
            success: true,
            doctors
        })
    } catch (error) {
        console.error('Get doctors error:', error.message)

        return res.status(500).json({
            success: false,
            message: 'Unable to fetch doctors'
        })
    }
}


// Admin only (protected in doctorRoute.js)
const addDoctor = async (req, res) => {
    try {
        const {
            name,
            password,
            image,
            speciality,
            degree,
            experience,
            about,
            fees,
            address
        } = req.body || {}

        const email = cleanEmail(req.body?.email)

        if (!name || !email || !password || !speciality) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, password and speciality are required'
            })
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            })
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            })
        }

        if (fees !== undefined && (isNaN(fees) || Number(fees) < 0)) {
            return res.status(400).json({
                success: false,
                message: 'Fees must be a number that is 0 or more'
            })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const doctor = await doctorModel.create({
            name: name.trim(),
            email,
            password: hashedPassword,
            image,
            speciality,
            degree,
            experience,
            about,
            fees,
            address
        })

        const safeDoctor = doctor.toObject()
        delete safeDoctor.password

        return res.status(201).json({
            success: true,
            message: 'Doctor added successfully',
            doctor: safeDoctor
        })
    } catch (error) {
        console.error('Add doctor error:', error.message)

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'A doctor with this email already exists'
            })
        }

        return res.status(500).json({
            success: false,
            message: 'Unable to add doctor'
        })
    }
}


const doctorLogin = async (req, res) => {
    try {
        const { password } = req.body || {}
        const email = cleanEmail(req.body?.email)

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please enter email and password'
            })
        }

        const doctor = await doctorModel.findOne({ email })

        if (!doctor) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            })
        }

        const isMatch = await bcrypt.compare(password, doctor.password)

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            })
        }

        const token = generateToken(doctor._id, 'doctor')

        return res.json({
            success: true,
            message: 'Login successful',
            token
        })
    } catch (error) {
        console.error('Doctor login error:', error.message)

        return res.status(500).json({
            success: false,
            message: 'Unable to login. Please try again'
        })
    }
}


// Returns the logged-in doctor's own profile
const getDoctorProfile = async (req, res) => {
    try {
        const doctor = await doctorModel
            .findById(req.doctorId)
            .select('-password')

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            })
        }

        return res.json({
            success: true,
            doctor
        })
    } catch (error) {
        console.error('Doctor profile error:', error.message)

        return res.status(500).json({
            success: false,
            message: 'Unable to load profile'
        })
    }
}


export { getDoctors, addDoctor, doctorLogin, getDoctorProfile }
