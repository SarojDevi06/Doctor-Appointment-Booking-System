import express from 'express'
import {
    getDoctors,
    addDoctor,
    doctorLogin,
    getDoctorProfile
} from '../controllers/doctorController.js'

import authAdmin from '../middleware/authAdmin.js'
import authDoctor from '../middleware/authDoctor.js'
import { loginLimiter } from '../middleware/rateLimiter.js'

const doctorRouter = express.Router()

// Public
doctorRouter.get('/list', getDoctors)
doctorRouter.post('/login', loginLimiter, doctorLogin)

// Doctor only
doctorRouter.get('/profile', authDoctor, getDoctorProfile)

// Admin only
doctorRouter.post('/add', authAdmin, addDoctor)

export default doctorRouter
