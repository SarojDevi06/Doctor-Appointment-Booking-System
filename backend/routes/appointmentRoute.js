import express from 'express'
import {
    bookAppointment,
    getUserAppointments,
    cancelAppointment,
    rescheduleAppointment,
    getAppointmentQueue
} from '../controllers/appointmentController.js'
import authUser from '../middleware/authUser.js'

const appointmentRouter = express.Router()

appointmentRouter.post('/book', authUser, bookAppointment)
appointmentRouter.get('/my-appointments', authUser, getUserAppointments)
appointmentRouter.put('/cancel', authUser, cancelAppointment)
appointmentRouter.put('/reschedule', authUser, rescheduleAppointment)
appointmentRouter.get('/queue/:appointmentId', authUser, getAppointmentQueue)

export default appointmentRouter
