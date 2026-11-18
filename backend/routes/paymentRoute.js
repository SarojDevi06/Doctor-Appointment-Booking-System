import express from 'express'
import { createOrder, verifyPayment, getPaymentStatus } from '../controllers/paymentController.js'
import authUser from '../middleware/authUser.js'

const paymentRouter = express.Router()

paymentRouter.get('/status', getPaymentStatus)
paymentRouter.post('/create-order', authUser, createOrder)
paymentRouter.post('/verify', authUser, verifyPayment)

export default paymentRouter
