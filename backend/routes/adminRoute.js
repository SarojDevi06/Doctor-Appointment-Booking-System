import express from 'express'
import { adminLogin, getAdminProfile, getDashboard } from '../controllers/adminController.js'
import {
    listDoctors,
    setDoctorApproval,
    updateDoctor,
    deleteDoctor,
    updateDoctorImageByAdmin,
    listPatients,
    setPatientBlocked,
    listAppointments,
    cancelAppointmentByAdmin,
    markRefunded,
    listHospitals,
    createHospital,
    updateHospital,
    deleteHospital,
    listMessages
} from '../controllers/adminManageController.js'

import authAdmin from '../middleware/authAdmin.js'
import { uploadImage } from '../middleware/upload.js'
import { loginLimiter } from '../middleware/rateLimiter.js'

const adminRouter = express.Router()

adminRouter.post('/login', loginLimiter, adminLogin)

// Everything below needs a logged-in admin
adminRouter.use(authAdmin)

adminRouter.get('/profile', getAdminProfile)
adminRouter.get('/dashboard', getDashboard)

adminRouter.get('/doctors', listDoctors)
adminRouter.put('/doctors/:id/approval', setDoctorApproval)
adminRouter.put('/doctors/:id/image', uploadImage, updateDoctorImageByAdmin)
adminRouter.put('/doctors/:id', updateDoctor)
adminRouter.delete('/doctors/:id', deleteDoctor)

adminRouter.get('/patients', listPatients)
adminRouter.put('/patients/:id/block', setPatientBlocked)

adminRouter.get('/appointments', listAppointments)
adminRouter.put('/appointments/:id/cancel', cancelAppointmentByAdmin)
adminRouter.put('/appointments/:id/refund', markRefunded)

adminRouter.get('/hospitals', listHospitals)
adminRouter.post('/hospitals', createHospital)
adminRouter.put('/hospitals/:id', updateHospital)
adminRouter.delete('/hospitals/:id', deleteHospital)

adminRouter.get('/messages', listMessages)

export default adminRouter
