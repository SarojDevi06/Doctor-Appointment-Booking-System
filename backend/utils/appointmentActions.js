import appointmentModel from '../models/appointmentModel.js'
import { freesSlot, makeSlotKey } from './appointmentRules.js'
import { checkBookingDate, isSlotOffered } from './slots.js'
import { ACTIVE_STATUSES } from './constants.js'

// Times already taken for one doctor on one date
export const getBookedTimes = async (doctorId, date) => {

    const booked = await appointmentModel
        .find({ doctorId, date, status: { $nin: ['Cancelled', 'Rejected'] } })
        .select('time')

    return booked.map(item => item.time)
}

// Changes the status of an appointment and keeps the related fields correct.
//   actor : 'patient', 'doctor' or 'admin' (who made the change)
export const changeStatus = async (appointment, newStatus, actor, note = '') => {

    appointment.status = newStatus
    appointment.statusNote = note

    if (newStatus === 'Cancelled') {
        appointment.cancelledBy = actor
    }

    if (freesSlot(newStatus)) {
        appointment.cancelled = true

        // Removing the slotKey gives the time slot back to other patients
        appointment.slotKey = undefined

        // A paid appointment that is cancelled needs a refund
        if (appointment.paymentStatus === 'Paid') {
            appointment.paymentStatus = 'Refund pending'
        }
    }

    if (newStatus === 'Completed') {
        appointment.queueStatus = 'Done'
    }

    await appointment.save()
}

// Moves an appointment to a new date and time.
// Returns { ok: true } or { ok: false, status, message }.
//   actor: 'patient' or 'doctor'
// A patient's change must be confirmed again by the doctor,
// so the appointment goes back to 'Pending'.
export const moveAppointment = async (appointment, doctor, newDate, newTime, actor) => {

    if (!ACTIVE_STATUSES.includes(appointment.status)) {
        return { ok: false, status: 400, message: `A ${appointment.status.toLowerCase()} appointment cannot be rescheduled` }
    }

    const dateError = checkBookingDate(newDate)

    if (dateError) {
        return { ok: false, status: 400, message: dateError }
    }

    if (!isSlotOffered(doctor, newDate, newTime)) {
        return { ok: false, status: 400, message: 'This time is not available for the doctor' }
    }

    if (appointment.date === newDate && appointment.time === newTime) {
        return { ok: false, status: 400, message: 'Please choose a different date or time' }
    }

    const slotTaken = await appointmentModel.findOne({
        _id: { $ne: appointment._id },
        doctorId: appointment.doctorId,
        date: newDate,
        time: newTime,
        status: { $nin: ['Cancelled', 'Rejected'] }
    })

    if (slotTaken) {
        return { ok: false, status: 409, message: 'This time slot is already booked. Please choose another' }
    }

    const patientBusy = await appointmentModel.findOne({
        _id: { $ne: appointment._id },
        userId: appointment.userId,
        date: newDate,
        time: newTime,
        status: { $in: ACTIVE_STATUSES }
    })

    if (patientBusy) {
        return { ok: false, status: 409, message: 'The patient already has another appointment at this time' }
    }

    appointment.date = newDate
    appointment.time = newTime
    appointment.slotKey = makeSlotKey(appointment.doctorId, newDate, newTime)
    appointment.rescheduleCount += 1
    appointment.queueStatus = 'Not arrived'

    if (actor === 'patient') {
        appointment.status = 'Pending'
    }

    try {
        await appointment.save()
    } catch (error) {
        // Someone booked the same slot at the same moment
        if (error.code === 11000) {
            return { ok: false, status: 409, message: 'This time slot was just booked by someone else' }
        }
        throw error
    }

    return { ok: true }
}
