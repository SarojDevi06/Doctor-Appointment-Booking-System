import appointmentModel from '../models/appointmentModel.js'
import doctorModel from '../models/doctorModel.js'
import { isValidId } from '../utils/validators.js'

const bookAppointment = async (req, res) => {

    try {

        // userId comes from the login token (set by authUser), not from the request body
        const userId = req.userId
        const { doctorId, date, time } = req.body || {}

        // Check required fields
        if (!doctorId || !date || !time) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all appointment details'
            })
        }

        if (!isValidId(doctorId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid doctor'
            })
        }

        // Check that the doctor exists and is accepting appointments
        const doctor = await doctorModel.findById(doctorId)

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            })
        }

        if (!doctor.available) {
            return res.status(400).json({
                success: false,
                message: 'This doctor is not available right now'
            })
        }

        // Check that the slot is not already booked
        const slotTaken = await appointmentModel.findOne({
            doctorId,
            date,
            time,
            cancelled: false
        })

        if (slotTaken) {
            return res.status(409).json({
                success: false,
                message: 'This time slot is already booked. Please choose another'
            })
        }

        // The fee always comes from the doctor's record, never from the request
        const appointment = await appointmentModel.create({
            userId,
            doctorId,
            date,
            time,
            amount: doctor.fees
        })

        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully',
            appointment
        })

    } catch (error) {

        console.log(error)

        res.status(500).json({
            success: false,
            message: 'Unable to book appointment'
        })
    }
}

const getUserAppointments = async (req, res) => {
    try {
        const appointments = await appointmentModel
            .find({ userId: req.userId })
            .populate('doctorId', '-password')
            .sort({ createdAt: -1 })

        res.json({
            success: true,
            appointments
        })
    } catch (error) {
        console.log(error)

        res.status(500).json({
            success: false,
            message: 'Unable to load appointments'
        })
    }
}

const cancelAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.body || {}

        if (!isValidId(appointmentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid appointment'
            })
        }

        // A patient can only cancel their own appointment
        const appointment = await appointmentModel.findOne({
            _id: appointmentId,
            userId: req.userId
        })

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            })
        }

        if (appointment.cancelled) {
            return res.status(400).json({
                success: false,
                message: 'Appointment is already cancelled'
            })
        }

        if (appointment.status === 'Completed') {
            return res.status(400).json({
                success: false,
                message: 'A completed appointment cannot be cancelled'
            })
        }

        appointment.cancelled = true
        appointment.status = 'Cancelled'
        await appointment.save()

        res.json({
            success: true,
            message: 'Appointment cancelled successfully'
        })

    } catch (error) {
        console.log(error)

        res.status(500).json({
            success: false,
            message: 'Unable to cancel appointment'
        })
    }
}

export { bookAppointment, getUserAppointments, cancelAppointment }
