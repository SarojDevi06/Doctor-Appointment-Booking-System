import express from 'express'
import {
    getDoctors,
    getDoctorById,
    getDoctorSlots,
    addDoctor,
    registerDoctor,
    doctorLogin,
    getDoctorProfile,
    updateDoctorProfile,
    updateAvailability,
    updateDoctorImage
} from '../controllers/doctorController.js'
import {
    getDashboard,
    getAppointments,
    updateAppointmentStatus,
    rescheduleByDoctor,
    getQueue,
    updateQueueStatus
} from '../controllers/doctorPanelController.js'

import authAdmin from '../middleware/authAdmin.js'
import authDoctor from '../middleware/authDoctor.js'
import requireApproved from '../middleware/requireApproved.js'
import { uploadImage } from '../middleware/upload.js'
import { loginLimiter } from '../middleware/rateLimiter.js'

const doctorRouter = express.Router()

// ----- Public -----
doctorRouter.get('/list', getDoctors)
doctorRouter.post('/register', loginLimiter, registerDoctor)
doctorRouter.post('/login', loginLimiter, doctorLogin)

// ----- Admin only -----
doctorRouter.post('/add', authAdmin, addDoctor)

// ----- Doctor (any status, so a doctor can see "waiting for approval") -----
doctorRouter.get('/profile', authDoctor, getDoctorProfile)
doctorRouter.put('/profile', authDoctor, updateDoctorProfile)
doctorRouter.put('/image', authDoctor, uploadImage, updateDoctorImage)

// ----- Approved doctors only -----
doctorRouter.put('/availability', authDoctor, requireApproved, updateAvailability)
doctorRouter.get('/dashboard', authDoctor, requireApproved, getDashboard)
doctorRouter.get('/appointments', authDoctor, requireApproved, getAppointments)
doctorRouter.put('/appointments/:id/status', authDoctor, requireApproved, updateAppointmentStatus)
doctorRouter.put('/appointments/:id/reschedule', authDoctor, requireApproved, rescheduleByDoctor)
doctorRouter.put('/appointments/:id/queue', authDoctor, requireApproved, updateQueueStatus)
doctorRouter.get('/queue', authDoctor, requireApproved, getQueue)

// ----- Public routes with an id. They must stay LAST, or "/:id" would
// catch words like "profile" and "dashboard" above. -----
doctorRouter.get('/:id/slots', getDoctorSlots)
doctorRouter.get('/:id', getDoctorById)

export default doctorRouter
