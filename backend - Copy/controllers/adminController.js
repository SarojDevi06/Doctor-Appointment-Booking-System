import userModel from '../models/userModel.js'
import bcrypt from 'bcryptjs'
import generateToken from '../utils/generateToken.js'
import { cleanEmail } from '../utils/validators.js'

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

export { adminLogin, getAdminProfile }
