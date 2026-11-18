// Creates the first admin account.
// Run once with:  npm run seed:admin
// It reads ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD from the .env file.

import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import userModel from '../models/userModel.js'
import { cleanEmail, isValidEmail, isValidPassword } from '../utils/validators.js'

const seedAdmin = async () => {

    const name = process.env.ADMIN_NAME || 'Admin'
    const email = cleanEmail(process.env.ADMIN_EMAIL)
    const password = process.env.ADMIN_PASSWORD

    if (!isValidEmail(email) || !isValidPassword(password)) {
        console.log('Set a valid ADMIN_EMAIL and an ADMIN_PASSWORD (8+ characters) in .env first')
        process.exit(1)
    }

    await mongoose.connect(process.env.MONGODB_URI)

    const existingUser = await userModel.findOne({ email })

    if (existingUser) {
        if (existingUser.role === 'admin') {
            console.log('Admin already exists:', email)
        } else {
            console.log('A patient account already uses this email. Use a different ADMIN_EMAIL')
        }
    } else {
        const hashedPassword = await bcrypt.hash(password, 10)

        await userModel.create({
            name,
            email,
            password: hashedPassword,
            role: 'admin'
        })

        console.log('Admin created:', email)
    }

    await mongoose.disconnect()
}

seedAdmin().catch((error) => {
    console.log('Seed failed:', error.message)
    process.exit(1)
})
