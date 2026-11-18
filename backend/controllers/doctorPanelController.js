import mongoose from 'mongoose'
import appointmentModel from '../models/appointmentModel.js'
import userModel from '../models/userModel.js'
import { isValidId } from '../utils/validators.js'
import { isValidDate, isValidTime, getNow, addDays } from '../utils/clinicTime.js'
import { canChangeStatus } from '../utils/appointmentRules.js'
import { changeStatus, moveAppointment } from '../utils/appointmentActions.js'
import { calculateQueue, getWaitingList } from '../utils/queue.js'
import { getReliabilityMap } from '../utils/doctorHelpers.js'
import { notifyPatient, formatSlot } from '../utils/notify.js'
import { escapeRegex, getPagination } from '../utils/pagination.js'

// All these routes are for approved doctors only (authDoctor + requireApproved).
// req.doctor is the logged-in doctor.

const patientFields = 'name email phone gender dob image'


// GET /api/doctor/dashboard
const getDashboard = async (req, res) => {
    try {
        const doctorId = new mongoose.Types.ObjectId(String(req.doctorId))
        const today = getNow().date

        // Number of appointments (and money) for each status
        const byStatus = await appointmentModel.aggregate([
            { $match: { doctorId } },
            { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }
        ])

        const counts = { Pending: 0, Confirmed: 0, Rejected: 0, Completed: 0, Cancelled: 0, 'No-Show': 0 }
        let earnings = 0

        byStatus.forEach((row) => {
            counts[row._id] = row.count
            if (row._id === 'Completed') earnings = row.amount
        })

        // Appointments per day for the last 7 days (today included)
        const startDate = addDays(today, -6)

        const perDay = await appointmentModel.aggregate([
            {
                $match: {
                    doctorId,
                    date: { $gte: startDate, $lte: today },
                    status: { $nin: ['Cancelled', 'Rejected'] }
                }
            },
            { $group: { _id: '$date', count: { $sum: 1 } } }
        ])

        const chart = []

        for (let i = 6; i >= 0; i--) {
            const date = addDays(today, -i)
            const found = perDay.find(row => row._id === date)
            chart.push({ date, count: found ? found.count : 0 })
        }

        const todayCount = await appointmentModel.countDocuments({
            doctorId,
            date: today,
            status: { $in: ['Pending', 'Confirmed', 'Completed'] }
        })

        const pendingRequests = await appointmentModel
            .find({ doctorId, status: 'Pending' })
            .sort({ date: 1, time: 1 })
            .limit(5)
            .populate('userId', 'name phone')

        const reliabilityMap = await getReliabilityMap([req.doctorId])

        res.json({
            success: true,
            stats: {
                total: Object.values(counts).reduce((sum, number) => sum + number, 0),
                pending: counts.Pending,
                confirmed: counts.Confirmed,
                completed: counts.Completed,
                cancelled: counts.Cancelled,
                rejected: counts.Rejected,
                noShow: counts['No-Show'],
                today: todayCount,
                earnings
            },
            chart,
            pendingRequests,
            reliability: reliabilityMap.get(String(req.doctorId))
        })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to load dashboard' })
    }
}


// GET /api/doctor/appointments?status=Pending&date=2026-11-05&search=ravi&page=1
const getAppointments = async (req, res) => {
    try {
        const { status, date, search } = req.query
        const { page, limit, skip } = getPagination(req.query)

        const filter = { doctorId: req.doctorId }

        if (status) filter.status = status
        if (date) filter.date = date

        if (search) {
            const patients = await userModel
                .find({ name: new RegExp(escapeRegex(search), 'i') })
                .select('_id')

            filter.userId = { $in: patients.map(patient => patient._id) }
        }

        const total = await appointmentModel.countDocuments(filter)

        const appointments = await appointmentModel
            .find(filter)
            .sort({ date: -1, time: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', patientFields)

        res.json({ success: true, appointments, total, page, pages: Math.ceil(total / limit) })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to load appointments' })
    }
}


// Finds one appointment that belongs to the logged-in doctor
const findMyAppointment = async (req, res) => {

    if (!isValidId(req.params.id)) {
        res.status(400).json({ success: false, message: 'Invalid appointment' })
        return null
    }

    const appointment = await appointmentModel.findOne({ _id: req.params.id, doctorId: req.doctorId })

    if (!appointment) {
        res.status(404).json({ success: false, message: 'Appointment not found' })
        return null
    }

    return appointment
}


// PUT /api/doctor/appointments/:id/status   body: { status, note }
const updateAppointmentStatus = async (req, res) => {
    try {
        const { status, note } = req.body || {}

        const appointment = await findMyAppointment(req, res)

        if (!appointment) return

        if (!canChangeStatus('doctor', appointment.status, status)) {
            return res.status(400).json({
                success: false,
                message: `An appointment that is ${appointment.status} cannot be changed to ${status}`
            })
        }

        // A visit can only be marked done or missed on or after its day
        const isVisitResult = status === 'Completed' || status === 'No-Show'

        if (isVisitResult && appointment.date > getNow().date) {
            return res.status(400).json({
                success: false,
                message: 'You cannot mark a future appointment as completed or missed'
            })
        }

        if (note && String(note).length > 300) {
            return res.status(400).json({ success: false, message: 'Note is too long (maximum 300 characters)' })
        }

        await changeStatus(appointment, status, 'doctor', note ? String(note).trim() : '')

        const when = formatSlot(appointment.date, appointment.time)
        const reasonText = note ? ` Reason: ${String(note).trim()}` : ''

        const messages = {
            Confirmed: ['Appointment confirmed', `${req.doctor.name} confirmed your appointment on ${when}.`],
            Rejected: ['Appointment not accepted', `${req.doctor.name} could not accept your appointment on ${when}.${reasonText}`],
            Cancelled: ['Appointment cancelled by doctor', `${req.doctor.name} cancelled your appointment on ${when}.${reasonText} Please book another time.`],
            Completed: ['Visit completed', `Your visit with ${req.doctor.name} on ${when} is marked as completed.`],
            'No-Show': ['Marked as missed', `Your appointment with ${req.doctor.name} on ${when} was marked as missed.`]
        }

        await notifyPatient(appointment.userId, messages[status][0], messages[status][1], appointment._id)

        res.json({ success: true, message: `Appointment ${status.toLowerCase()}`, appointment })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to update appointment' })
    }
}


// PUT /api/doctor/appointments/:id/reschedule   body: { date, time }
const rescheduleByDoctor = async (req, res) => {
    try {
        const { date, time } = req.body || {}

        if (!isValidDate(date) || !isValidTime(time)) {
            return res.status(400).json({ success: false, message: 'Please choose a valid date and time' })
        }

        const appointment = await findMyAppointment(req, res)

        if (!appointment) return

        const oldSlot = formatSlot(appointment.date, appointment.time)

        const result = await moveAppointment(appointment, req.doctor, date, time, 'doctor')

        if (!result.ok) {
            return res.status(result.status).json({ success: false, message: result.message })
        }

        await notifyPatient(
            appointment.userId,
            'Appointment rescheduled by doctor',
            `${req.doctor.name} moved your appointment from ${oldSlot} to ${formatSlot(date, time)}.`,
            appointment._id
        )

        res.json({ success: true, message: 'Appointment rescheduled. The patient has been notified.', appointment })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to reschedule appointment' })
    }
}


// Today's confirmed appointments of one doctor
const getTodaysAppointments = (doctorId) => {
    return appointmentModel
        .find({ doctorId, date: getNow().date, status: { $in: ['Confirmed', 'Completed'] } })
        .populate('userId', patientFields)
}


// GET /api/doctor/queue
// Today's queue with the position and estimated wait of every patient
const getQueue = async (req, res) => {
    try {
        const todays = await getTodaysAppointments(req.doctorId)

        const waiting = getWaitingList(todays)

        const queue = waiting.map((appointment) => ({
            appointment,
            ...calculateQueue(todays, appointment._id, req.doctor.slotDuration)
        }))

        const finished = todays.filter(item => item.queueStatus === 'Done').length

        res.json({
            success: true,
            date: getNow().date,
            slotDuration: req.doctor.slotDuration,
            queue,
            finished,
            totalToday: todays.length
        })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to load the queue' })
    }
}


// PUT /api/doctor/appointments/:id/queue   body: { queueStatus: 'Waiting' | 'In consultation' | 'Done' }
const updateQueueStatus = async (req, res) => {
    try {
        const { queueStatus } = req.body || {}

        if (!['Waiting', 'In consultation', 'Done'].includes(queueStatus)) {
            return res.status(400).json({ success: false, message: 'Queue status must be Waiting, In consultation or Done' })
        }

        const appointment = await findMyAppointment(req, res)

        if (!appointment) return

        if (appointment.status !== 'Confirmed') {
            return res.status(400).json({ success: false, message: 'Only confirmed appointments can be in the queue' })
        }

        if (appointment.date !== getNow().date) {
            return res.status(400).json({ success: false, message: 'The queue is only for today\'s appointments' })
        }

        if (queueStatus === 'In consultation') {
            const busy = await appointmentModel.findOne({
                doctorId: req.doctorId,
                date: appointment.date,
                queueStatus: 'In consultation',
                _id: { $ne: appointment._id }
            })

            if (busy) {
                return res.status(409).json({ success: false, message: 'Finish the current consultation first' })
            }
        }

        if (queueStatus === 'Done') {
            await changeStatus(appointment, 'Completed', 'doctor')
        } else {
            appointment.queueStatus = queueStatus
            await appointment.save()
        }

        if (queueStatus === 'In consultation') {
            await notifyPatient(appointment.userId, 'It is your turn', `${req.doctor.name} is ready to see you now.`, appointment._id)
        }

        res.json({ success: true, message: `Marked as ${queueStatus}`, appointment })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to update the queue' })
    }
}


export {
    getDashboard,
    getAppointments,
    updateAppointmentStatus,
    rescheduleByDoctor,
    getQueue,
    updateQueueStatus
}
