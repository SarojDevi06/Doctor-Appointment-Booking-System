import appointmentModel from '../models/appointmentModel.js'
import { isValidId } from '../utils/validators.js'
import { isValidPaymentSignature } from '../utils/payment.js'
import { notifyDoctor, formatSlot } from '../utils/notify.js'

// Online payment with Razorpay (use TEST keys while developing).
// Flow:
//   1. The frontend asks us to create an order           -> createOrder
//   2. The patient pays in the Razorpay window
//   3. The frontend sends us the payment details          -> verifyPayment
//   4. WE check the signature. Only then the payment counts as paid.

const isPaymentConfigured = () => {
    return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

// POST /api/payment/create-order   body: { appointmentId }
const createOrder = async (req, res) => {
    try {
        if (!isPaymentConfigured()) {
            return res.status(503).json({ success: false, message: 'Online payment is not available right now. You can pay at the clinic.' })
        }

        const { appointmentId } = req.body || {}

        if (!isValidId(appointmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid appointment' })
        }

        const appointment = await appointmentModel.findOne({ _id: appointmentId, userId: req.userId })

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' })
        }

        if (!['Pending', 'Confirmed'].includes(appointment.status)) {
            return res.status(400).json({ success: false, message: 'This appointment cannot be paid for' })
        }

        if (appointment.paymentStatus === 'Paid') {
            return res.status(400).json({ success: false, message: 'This appointment is already paid' })
        }

        if (!appointment.amount || appointment.amount <= 0) {
            return res.status(400).json({ success: false, message: 'There is no fee to pay for this appointment' })
        }

        // The amount comes from the appointment saved in our database, never from the browser.
        // Razorpay wants the amount in paise (1 rupee = 100 paise).
        const keyAuth = Buffer
            .from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`)
            .toString('base64')

        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${keyAuth}`
            },
            body: JSON.stringify({
                amount: Math.round(appointment.amount * 100),
                currency: 'INR',
                receipt: String(appointment._id)
            })
        })

        const order = await response.json()

        if (!response.ok) {
            console.log('Razorpay order error:', order)

            return res.status(502).json({ success: false, message: 'Could not start the payment. Please try again' })
        }

        appointment.paymentOrderId = order.id
        await appointment.save()

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        })

    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to start the payment' })
    }
}

// POST /api/payment/verify
// body: { appointmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
const verifyPayment = async (req, res) => {
    try {
        if (!isPaymentConfigured()) {
            return res.status(503).json({ success: false, message: 'Online payment is not available right now' })
        }

        const { appointmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {}

        if (!isValidId(appointmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid appointment' })
        }

        const appointment = await appointmentModel.findOne({ _id: appointmentId, userId: req.userId })

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' })
        }

        if (appointment.paymentStatus === 'Paid') {
            return res.json({ success: true, message: 'Payment already received' })
        }

        // The order must be the one we created for this appointment
        const orderMatches = appointment.paymentOrderId && appointment.paymentOrderId === razorpay_order_id

        const signatureIsValid = isValidPaymentSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            process.env.RAZORPAY_KEY_SECRET
        )

        if (!orderMatches || !signatureIsValid) {
            appointment.paymentStatus = 'Failed'
            await appointment.save()

            return res.status(400).json({ success: false, message: 'Payment could not be verified. If money was deducted, please contact support.' })
        }

        appointment.paymentStatus = 'Paid'
        appointment.paymentId = razorpay_payment_id
        await appointment.save()

        await notifyDoctor(
            appointment.doctorId,
            'Payment received',
            `Online payment of ₹${appointment.amount} received for the appointment on ${formatSlot(appointment.date, appointment.time)}.`,
            appointment._id
        )

        res.json({ success: true, message: 'Payment successful' })

    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to verify the payment' })
    }
}

// GET /api/payment/status  (lets the frontend know if online payment is turned on)
const getPaymentStatus = (req, res) => {
    res.json({ success: true, enabled: isPaymentConfigured() })
}

export { createOrder, verifyPayment, getPaymentStatus }
