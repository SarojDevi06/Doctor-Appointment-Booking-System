import userModel from '../models/userModel.js'
import bcrypt from 'bcryptjs'
import generateToken from '../utils/generateToken.js'
import {
    cleanEmail,
    isValidEmail,
    isValidPassword,
    isValidPhone
} from '../utils/validators.js'

const registerUser = async (req, res) => {

    try {

        const { name, password } = req.body || {}
        const email = cleanEmail(req.body?.email)

        // Check all fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please enter all required fields'
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

        // Check if user already exists
        const existingUser = await userModel.findOne({ email })

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User already exists'
            })
        }

        // Hash password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        // Create new user (role is 'patient' by default)
        const user = await userModel.create({
            name: name.trim(),
            email,
            password: hashedPassword
        })

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            userId: user._id
        })

    } catch (error) {

        console.log(error)

        res.status(500).json({
            success: false,
            message: 'Unable to register. Please try again'
        })
    }
}

const loginUser = async (req, res) => {

    try {

        const { password } = req.body || {}
        const email = cleanEmail(req.body?.email)

        // Check all fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please enter email and password'
            })
        }

        // Find user. Admin accounts must use the admin login instead.
        const user = await userModel.findOne({ email })

        // Same message for "no user" and "wrong password" so that
        // nobody can find out which emails are registered
        if (!user || user.role === 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            })
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password)

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            })
        }

        const token = generateToken(user._id, 'patient')

        res.json({
            success: true,
            message: 'Login successful',
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

const getProfile = async (req, res) => {

    try {

        const user = await userModel.findById(req.userId).select('-password')

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            })
        }

        res.json({
            success: true,
            user
        })

    } catch (error) {

        console.log(error)

        res.status(500).json({
            success: false,
            message: 'Unable to load profile'
        })
    }
}

const updateProfile = async (req, res) => {

    try {

        const { name, phone, address, gender, dob } = req.body || {}

        if (name !== undefined && !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Name cannot be empty'
            })
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid phone number (10 to 15 digits)'
            })
        }

        // Only these fields can be changed. Role and email cannot.
        const updates = {}

        if (name !== undefined) updates.name = String(name).trim()
        if (phone !== undefined) updates.phone = phone
        if (address !== undefined) updates.address = address
        if (gender !== undefined) updates.gender = gender
        if (dob !== undefined) updates.dob = dob

        await userModel.findByIdAndUpdate(req.userId, updates)

        res.json({
            success: true,
            message: 'Profile updated successfully'
        })

    } catch (error) {

        console.log(error)

        res.status(500).json({
            success: false,
            message: 'Unable to update profile'
        })
    }
}

export { registerUser, loginUser, getProfile, updateProfile }
