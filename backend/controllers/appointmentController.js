import appointmentModel from '../models/appointmentModel.js'
import doctorModel from '../models/doctorModel.js'
import userModel from '../models/userModel.js'
import { isValidId } from '../utils/validators.js'
import { isValidDate, isValidTime, getNow } from '../utils/clinicTime.js'
import { checkBookingDate, isSlotOffered } from '../utils/slots.js'
import { makeSlotKey, canChangeStatus } from '../utils/appointmentRules.js'
import { changeStatus, moveAppointment } from '../utils/appointmentActions.js'
import { calculateQueue } from '../utils/queue.js'
import { ACTIVE_STATUSES } from '../utils/constants.js'
import { approvedDoctorFilter } from '../utils/doctorHelpers.js'
import { notifyPatient, notifyDoctor, formatSlot } from '../utils/notify.js'

// POST /api/appointment/book   body: { doctorId, date: "2026-11-05", time: "14:30", reason }
const bookAppointment = async (req, res) => {

    try {

        // userId comes from the login token (set by authUser), not from the request body
        const userId = req.userId
        const { doctorId, date, time, reason } = req.body || {}

        if (!doctorId || !date || !time) {
            return res.status(400).json({ success: false, message: 'Please provide all appointment details' })
        }

        if (!isValidId(doctorId)) {
            return res.status(400).json({ success: false, message: 'Invalid doctor' })
        }

        if (!isValidDate(date) || !isValidTime(time)) {
            return res.status(400).json({ success: false, message: 'Please choose a valid date and time' })
        }

        if (reason && String(reason).length > 300) {
            return res.status(400).json({ success: false, message: 'Reason is too long (maximum 300 characters)' })
        }

        // A blocked patient cannot book
        const patient = await userModel.findById(userId).select('name isBlocked')

        if (!patient || patient.isBlocked) {
            return res.status(403).json({ success: false, message: 'Your account is blocked. Please contact support' })
        }

        // The doctor must exist, be approved and accept appointments
        const doctor = await doctorModel.findOne({ _id: doctorId, ...approvedDoctorFilter })

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' })
        }

        if (!doctor.available) {
            return res.status(400).json({ success: false, message: 'This doctor is not accepting appointments right now' })
        }

        const dateError = checkBookingDate(date)

        if (dateError) {
            return res.status(400).json({ success: false, message: dateError })
        }

        // The time must really be one of the doctor's slots
        if (!isSlotOffered(doctor, date, time)) {
            return res.status(400).json({ success: false, message: 'The doctor is not available at this time' })
        }

        // The patient cannot be in two places at the same time
        const patientBusy = await appointmentModel.findOne({
            userId,
            date,
            time,
            status: { $in: ACTIVE_STATUSES }
        })

        if (patientBusy) {
            return res.status(409).json({ success: false, message: 'You already have an appointment at this time' })
        }

        // One active appointment per doctor per day
        const sameDoctorToday = await appointmentModel.findOne({
            userId,
            doctorId,
            date,
            status: { $in: ACTIVE_STATUSES }
        })

        if (sameDoctorToday) {
            return res.status(409).json({ success: false, message: 'You already have an appointment with this doctor on this day' })
        }

        // Check that the slot is free. The unique slotKey index below is the real
        // protection if two patients press "book" at the same moment.
        const slotTaken = await appointmentModel.findOne({
            doctorId,
            date,
            time,
            status: { $nin: ['Cancelled', 'Rejected'] }
        })

        if (slotTaken) {
            return res.status(409).json({ success: false, message: 'This time slot is already booked. Please choose another' })
        }

        // The fee always comes from the doctor's record, never from the request
        let appointment

        try {
            appointment = await appointmentModel.create({
                userId,
                doctorId,
                date,
                time,
                reason: reason ? String(reason).trim() : '',
                amount: doctor.fees,
                slotKey: makeSlotKey(doctorId, date, time)
            })
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({ success: false, message: 'This time slot was just booked by someone else. Please choose another' })
            }
            throw error
        }

        const when = formatSlot(date, time)

        await notifyDoctor(doctorId, 'New appointment request', `${patient.name} requested an appointment on ${when}.`, appointment._id)
        await notifyPatient(userId, 'Appointment requested', `Your request for ${doctor.name} on ${when} was sent. You will be notified when the doctor confirms.`, appointment._id)

        res.status(201).json({
            success: true,
            message: 'Appointment requested. The doctor will confirm it soon.',
            appointment
        })

    } catch (error) {

        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to book appointment' })
    }
}


// GET /api/appointment/my-appointments
const getUserAppointments = async (req, res) => {
    try {
        const appointments = await appointmentModel
            .find({ userId: req.userId })
            .populate({
                path: 'doctorId',
                select: 'name speciality image fees degree address slotDuration hospitalId',
                populate: { path: 'hospitalId', select: 'name type line1 city phone' }
            })
            .sort({ createdAt: -1 })

        res.json({ success: true, appointments })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to load appointments' })
    }
}


// Finds one appointment that belongs to the logged-in patient
const findMyAppointment = async (req, res, appointmentId) => {

    if (!isValidId(appointmentId)) {
        res.status(400).json({ success: false, message: 'Invalid appointment' })
        return null
    }

    const appointment = await appointmentModel.findOne({ _id: appointmentId, userId: req.userId })

    if (!appointment) {
        res.status(404).json({ success: false, message: 'Appointment not found' })
        return null
    }

    return appointment
}


// PUT /api/appointment/cancel   body: { appointmentId }
const cancelAppointment = async (req, res) => {
    try {
        const appointment = await findMyAppointment(req, res, req.body?.appointmentId)

        if (!appointment) return

        if (appointment.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Appointment is already cancelled' })
        }

        if (!canChangeStatus('patient', appointment.status, 'Cancelled')) {
            return res.status(400).json({
                success: false,
                message: `A ${appointment.status.toLowerCase()} appointment cannot be cancelled`
            })
        }

        await changeStatus(appointment, 'Cancelled', 'patient')

        const patient = await userModel.findById(req.userId).select('name')

        await notifyDoctor(
            appointment.doctorId,
            'Appointment cancelled by patient',
            `${patient ? patient.name : 'A patient'} cancelled the appointment on ${formatSlot(appointment.date, appointment.time)}.`,
            appointment._id
        )

        res.json({ success: true, message: 'Appointment cancelled successfully' })

    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to cancel appointment' })
    }
}


// PUT /api/appointment/reschedule   body: { appointmentId, date, time }
const rescheduleAppointment = async (req, res) => {
    try {
        const { appointmentId, date, time } = req.body || {}

        if (!isValidDate(date) || !isValidTime(time)) {
            return res.status(400).json({ success: false, message: 'Please choose a valid date and time' })
        }

        const appointment = await findMyAppointment(req, res, appointmentId)

        if (!appointment) return

        const doctor = await doctorModel.findOne({ _id: appointment.doctorId, ...approvedDoctorFilter })

        if (!doctor || !doctor.available) {
            return res.status(400).json({ success: false, message: 'This doctor is not accepting appointments right now' })
        }

        const oldSlot = formatSlot(appointment.date, appointment.time)

        const result = await moveAppointment(appointment, doctor, date, time, 'patient')

        if (!result.ok) {
            return res.status(result.status).json({ success: false, message: result.message })
        }

        const patient = await userModel.findById(req.userId).select('name')

        await notifyDoctor(
            doctor._id,
            'Appointment rescheduled by patient',
            `${patient ? patient.name : 'A patient'} moved the appointment from ${oldSlot} to ${formatSlot(date, time)}. Please confirm the new time.`,
            appointment._id
        )

        res.json({ success: true, message: 'Appointment rescheduled. The doctor needs to confirm the new time.', appointment })

    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to reschedule appointment' })
    }
}


// GET /api/appointment/queue/:appointmentId
// Where the patient is in today's queue and the estimated waiting time
const getAppointmentQueue = async (req, res) => {
    try {
        const appointment = await findMyAppointment(req, res, req.params.appointmentId)

        if (!appointment) return

        if (appointment.date !== getNow().date || appointment.status !== 'Confirmed') {
            return res.json({ success: true, inQueue: false })
        }

        const doctor = await doctorModel.findById(appointment.doctorId).select('slotDuration')

        const todays = await appointmentModel.find({
            doctorId: appointment.doctorId,
            date: appointment.date,
            status: { $in: ['Confirmed', 'Completed'] }
        })

        const queue = calculateQueue(todays, appointment._id, doctor ? doctor.slotDuration : 30)

        res.json({ success: true, inQueue: !!queue, queue })

    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to load the queue' })
    }
}


export {
    bookAppointment,
    getUserAppointments,
    cancelAppointment,
    rescheduleAppointment,
    getAppointmentQueue
}
