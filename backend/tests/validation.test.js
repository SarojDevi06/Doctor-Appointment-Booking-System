// Tests the input checks of the controllers WITHOUT a database.
// Every case here must be rejected BEFORE any database call. If a controller
// tried to use the database anyway, the call would fail (buffering is off)
// and the test would get a 500 instead of the expected 400.
import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'

import { registerDoctor, updateAvailability, updateDoctorProfile, getDoctorSlots } from '../controllers/doctorController.js'
import { bookAppointment, cancelAppointment, rescheduleAppointment } from '../controllers/appointmentController.js'
import { updateAppointmentStatus, updateQueueStatus, rescheduleByDoctor } from '../controllers/doctorPanelController.js'
import { setDoctorApproval, setPatientBlocked, createHospital, updateDoctor } from '../controllers/adminManageController.js'
import { chat } from '../controllers/assistantController.js'
import { createOrder, verifyPayment } from '../controllers/paymentController.js'
import { markAsRead } from '../controllers/notificationController.js'
import { addDays, getNow } from '../utils/clinicTime.js'

mongoose.set('bufferCommands', false)

// Calls a controller with a fake request and returns what it answered
const call = async (controller, { body, params, query, userId, doctorId } = {}) => {
    let result = { status: 200, json: undefined }

    const res = {
        status(code) { result.status = code; return this },
        json(data) { result.json = data; return this }
    }

    await controller({ body, params: params || {}, query: query || {}, userId, doctorId, auth: { id: 'x', role: 'patient' } }, res)

    return result
}

const validId = '507f1f77bcf86cd799439011'
const today = getNow().date

const goodDoctor = {
    name: 'Dr Test', email: 'dr@example.com', password: 'Password123',
    speciality: 'General physician', fees: 500, hospitalId: validId
}

test('doctor registration is validated', async () => {
    const cases = [
        [{}, /required/],
        [{ ...goodDoctor, email: 'nope' }, /valid email/],
        [{ ...goodDoctor, password: 'short' }, /8 characters/],
        [{ ...goodDoctor, fees: undefined }, /fee/],
        [{ ...goodDoctor, fees: -1 }, /fee/],
        [{ ...goodDoctor, phone: 'abc' }, /phone/],
        [{ ...goodDoctor, hospitalId: undefined }, /hospital or enter your clinic/]
    ]

    for (const [body, pattern] of cases) {
        const result = await call(registerDoctor, { body })
        assert.equal(result.status, 400, JSON.stringify(body))
        assert.match(result.json.message, pattern)
    }
})

test('availability is validated', async () => {
    const send = (body) => call(updateAvailability, { body, doctorId: validId })

    assert.equal((await send({})).status, 400)                                                                      // nothing to update
    assert.equal((await send({ availability: 'monday' })).status, 400)
    assert.equal((await send({ availability: [{ day: 7, startTime: '09:00', endTime: '10:00' }] })).status, 400)    // bad day
    assert.equal((await send({ availability: [{ day: 1, startTime: '9am', endTime: '10:00' }] })).status, 400)      // bad time
    assert.equal((await send({ availability: [{ day: 1, startTime: '10:00', endTime: '09:00' }] })).status, 400)    // end before start
    assert.equal((await send({ availability: [{ day: 1, startTime: '10:00', endTime: '10:00' }] })).status, 400)    // zero length

    const overlap = await send({ availability: [
        { day: 1, startTime: '09:00', endTime: '12:00' },
        { day: 1, startTime: '11:00', endTime: '14:00' }
    ] })
    assert.equal(overlap.status, 400)
    assert.match(overlap.json.message, /overlap/)

    assert.equal((await send({ slotDuration: 25 })).status, 400)                  // not an allowed length
    assert.equal((await send({ unavailableDates: ['10 Nov'] })).status, 400)
    assert.equal((await send({ unavailableDates: 'tomorrow' })).status, 400)
})

test('doctor profile update is validated', async () => {
    const send = (body) => call(updateDoctorProfile, { body, doctorId: validId })

    assert.equal((await send({ name: '   ' })).status, 400)
    assert.equal((await send({ fees: -5 })).status, 400)
    assert.equal((await send({ fees: 'abc' })).status, 400)
    assert.equal((await send({ phone: '12' })).status, 400)
    assert.equal((await send({ available: 'yes' })).status, 400)
})

test('slots request is validated', async () => {
    const send = (id, date) => call(getDoctorSlots, { params: { id }, query: { date } })

    assert.equal((await send('abc', today)).status, 400)
    assert.equal((await send(validId, undefined)).status, 400)
    assert.equal((await send(validId, '05-11-2026')).status, 400)
    assert.equal((await send(validId, addDays(today, -1))).status, 400)
    assert.match((await send(validId, addDays(today, -1))).json.message, /past/)
    assert.match((await send(validId, addDays(today, 31))).json.message, /30 days/)
})

test('booking is validated', async () => {
    const send = (body) => call(bookAppointment, { body, userId: validId })
    const good = { doctorId: validId, date: addDays(today, 1), time: '10:00' }

    assert.equal((await send({})).status, 400)
    assert.equal((await send({ ...good, doctorId: 'abc' })).status, 400)
    assert.equal((await send({ ...good, date: '26 Sep 2026' })).status, 400)       // the old format is no longer accepted
    assert.equal((await send({ ...good, time: '10:00 AM' })).status, 400)
    assert.equal((await send({ ...good, reason: 'x'.repeat(301) })).status, 400)
})

test('cancel and reschedule are validated', async () => {
    assert.equal((await call(cancelAppointment, { body: { appointmentId: 'abc' }, userId: validId })).status, 400)
    assert.equal((await call(cancelAppointment, { body: {}, userId: validId })).status, 400)

    const send = (body) => call(rescheduleAppointment, { body, userId: validId })
    assert.equal((await send({ appointmentId: validId, date: 'tomorrow', time: '10:00' })).status, 400)
    assert.equal((await send({ appointmentId: validId, date: addDays(today, 1), time: '10am' })).status, 400)
})

test('doctor appointment actions are validated', async () => {
    assert.equal((await call(updateAppointmentStatus, { params: { id: 'abc' }, body: { status: 'Confirmed' }, doctorId: validId })).status, 400)
    assert.equal((await call(rescheduleByDoctor, { params: { id: validId }, body: { date: 'x', time: 'y' }, doctorId: validId })).status, 400)
    assert.equal((await call(updateQueueStatus, { params: { id: validId }, body: { queueStatus: 'Sleeping' }, doctorId: validId })).status, 400)
})

test('admin actions are validated', async () => {
    assert.equal((await call(setDoctorApproval, { params: { id: 'abc' }, body: { status: 'approved' } })).status, 400)
    assert.equal((await call(setDoctorApproval, { params: { id: validId }, body: { status: 'maybe' } })).status, 400)
    assert.equal((await call(setPatientBlocked, { params: { id: validId }, body: { blocked: 'yes' } })).status, 400)
    assert.equal((await call(createHospital, { body: {} })).status, 400)
    assert.equal((await call(createHospital, { body: { name: 'City Care', type: 'Pharmacy' } })).status, 400)
    assert.equal((await call(createHospital, { body: { name: 'City Care', phone: 'abc' } })).status, 400)
    assert.equal((await call(updateDoctor, { params: { id: validId }, body: { password: 'short' } })).status, 400)
    assert.equal((await call(updateDoctor, { params: { id: validId }, body: { fees: -1 } })).status, 400)
})

test('assistant: validation and the emergency answer (no database needed)', async () => {
    assert.equal((await call(chat, { body: {} })).status, 400)
    assert.equal((await call(chat, { body: { message: 'x'.repeat(501) } })).status, 400)

    const emergency = await call(chat, { body: { message: 'I have chest pain' } })
    assert.equal(emergency.status, 200)
    assert.equal(emergency.json.type, 'emergency')
    assert.match(emergency.json.reply, /112/)
})

test('payment: not available without keys, invalid ids rejected', async () => {
    delete process.env.RAZORPAY_KEY_ID
    delete process.env.RAZORPAY_KEY_SECRET

    assert.equal((await call(createOrder, { body: { appointmentId: validId }, userId: validId })).status, 503)
    assert.equal((await call(verifyPayment, { body: {}, userId: validId })).status, 503)

    process.env.RAZORPAY_KEY_ID = 'rzp_test_x'
    process.env.RAZORPAY_KEY_SECRET = 'secret'

    assert.equal((await call(createOrder, { body: { appointmentId: 'abc' }, userId: validId })).status, 400)
    assert.equal((await call(verifyPayment, { body: { appointmentId: 'abc' }, userId: validId })).status, 400)
})

test('notification id is validated', async () => {
    assert.equal((await call(markAsRead, { params: { id: 'abc' } })).status, 400)
})
