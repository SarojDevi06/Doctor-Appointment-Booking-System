import express from 'express'

import {bookAppointment, getUserAppointments, cancelAppointment} from '../controllers/appointmentController.js'

import authUser from '../middleware/authUser.js'

const appointmentRouter = express.Router()

appointmentRouter.post('/book', authUser, bookAppointment)

appointmentRouter.get('/my-appointments', authUser, getUserAppointments)

appointmentRouter.put('/cancel', authUser, cancelAppointment)

export default appointmentRouter