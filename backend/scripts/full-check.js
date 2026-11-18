// Checks the WHOLE backend against a RUNNING server and your real database.
//
//   1. Create the admin once:        npm run seed:admin
//   2. Start the server (terminal 1): npm run server
//   3. Run this (terminal 2):         npm run check:full
//
// It creates test records (emails start with "full-check-", names with "FullCheck")
// and deletes all of them at the end. No real emails are sent (example.com is ignored).
// If you see "Too many attempts" (HTTP 429), restart the server and run it again.

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import mongoose from 'mongoose'
import userModel from '../models/userModel.js'
import doctorModel from '../models/doctorModel.js'
import hospitalModel from '../models/hospitalModel.js'
import appointmentModel from '../models/appointmentModel.js'
import notificationModel from '../models/notificationModel.js'
import { uploadFolder } from '../middleware/upload.js'
import { getNow, addDays, getDayOfWeek } from '../utils/clinicTime.js'

const BASE = `http://localhost:${process.env.PORT || 4000}`
const stamp = Date.now()
const password = 'TestPass123'
const emailOf = (label) => `full-check-${label}-${stamp}@example.com`

const today = getNow().date
const tomorrow = addDays(today, 1)

let passed = 0
let failed = 0
const uploadedFiles = []

const api = async (method, url, body, token) => {
    const headers = {}
    if (token) headers.token = token

    let payload
    if (body instanceof FormData) {
        payload = body
    } else if (body) {
        headers['Content-Type'] = 'application/json'
        payload = JSON.stringify(body)
    }

    const response = await fetch(BASE + url, { method, headers, body: payload })
    const data = await response.json().catch(() => ({}))

    return { status: response.status, data }
}

const check = (title, condition, extra = '') => {
    if (condition) {
        passed++
        console.log(`  PASS  ${title}`)
    } else {
        failed++
        console.log(`  FAIL  ${title} ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`)
    }
}

const section = (title) => console.log(`\n${title}`)

// ---------- small helpers ----------
const makePatient = async (label) => {
    const email = emailOf(label)
    await api('POST', '/api/user/register', { name: `FullCheck Patient ${label}`, email, password })
    const login = await api('POST', '/api/user/login', { email, password })
    const profile = await api('GET', '/api/user/profile', null, login.data.token)
    return { email, token: login.data.token, id: profile.data.user?._id }
}

const everyDay = (startTime, endTime) => [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, startTime, endTime }))

const getSlots = async (doctorId, date) => (await api('GET', `/api/doctor/${doctorId}/slots?date=${date}`)).data.slots || []

const isSlotFree = async (doctorId, date, time) => {
    const slots = await getSlots(doctorId, date)
    const slot = slots.find(item => item.time === time)
    return !!slot && slot.available
}

const book = (patient, doctorId, date, time, extra = {}) =>
    api('POST', '/api/appointment/book', { doctorId, date, time, ...extra }, patient.token)

const notificationsOf = async (token) => (await api('GET', '/api/notification/list', null, token)).data

const hasNotification = async (token, text) => {
    const result = await notificationsOf(token)
    return (result.notifications || []).some(item => (item.title + ' ' + item.message).includes(text))
}

const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
)

const imageForm = (bytes, type, name) => {
    const form = new FormData()
    form.append('image', new Blob([bytes], { type }), name)
    return form
}

// =====================================================================
const run = async () => {

    console.log(`\nChecking ${BASE}   (today ${today}, tomorrow ${tomorrow})`)

    // ---------------------------------------------------------------
    section('1. Admin, hospitals and doctors added by the admin')

    let result = await api('POST', '/api/admin/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    const adminToken = result.data.token
    check('Admin login works (did you run npm run seed:admin?)', result.status === 200 && !!adminToken, result.data)

    const patient1 = await makePatient('p1')
    const patient2 = await makePatient('p2')
    check('Two test patients created', !!patient1.token && !!patient2.token)

    result = await api('POST', '/api/admin/hospitals', { name: 'FullCheck City Hospital', type: 'Hospital', city: 'Testville', line1: '1 Test Road' }, patient1.token)
    check('Patient cannot create a hospital (403)', result.status === 403)

    result = await api('POST', '/api/admin/hospitals', { name: 'FullCheck Bad', type: 'Pharmacy' }, adminToken)
    check('Hospital with a wrong type is rejected (400)', result.status === 400)

    result = await api('POST', '/api/admin/hospitals', { name: 'FullCheck City Hospital', type: 'Hospital', city: 'Testville', line1: '1 Test Road' }, adminToken)
    const hospitalId = result.data.hospital?._id
    check('Admin creates a hospital (201)', result.status === 201 && !!hospitalId, result.data)

    const doctorFields = {
        password,
        speciality: 'General physician',
        degree: 'MBBS',
        experience: '6 Years',
        fees: 600,
        hospitalId
    }

    result = await api('POST', '/api/doctor/add', { ...doctorFields, name: 'FullCheck Dr A', email: emailOf('docA') }, adminToken)
    const doctorA = { id: result.data.doctor?._id, email: emailOf('docA') }
    check('Admin adds doctor A (201)', result.status === 201 && !!doctorA.id, result.data)

    result = await api('POST', '/api/doctor/add', { ...doctorFields, name: 'FullCheck Dr A', email: emailOf('docA'), hospitalId: 'abc' }, adminToken)
    check('Adding a doctor with an invalid hospital is rejected (400)', result.status === 400)

    result = await api('POST', '/api/doctor/login', { email: doctorA.email, password })
    doctorA.token = result.data.token
    check('Doctor A can login and is approved', result.status === 200 && result.data.approvalStatus === 'approved', result.data)

    result = await api('PUT', '/api/doctor/availability', { availability: everyDay('09:00', '12:00'), slotDuration: 30 }, doctorA.token)
    check('Doctor A sets working hours 09:00-12:00 every day', result.status === 200, result.data)

    // ---------------------------------------------------------------
    section('2. What patients see')

    result = await api('GET', '/api/doctor/list')
    const listedA = (result.data.doctors || []).find(doctor => doctor._id === doctorA.id)
    check('Doctor A is in the public list', !!listedA)
    check('Public list shows the hospital name', listedA?.hospital?.name === 'FullCheck City Hospital', listedA?.hospital)
    check('Public list never shows password or email', listedA && !('password' in listedA) && !('email' in listedA))
    check('Reliability is hidden for a new doctor (no fake number)', listedA?.reliability?.percent === null)

    result = await api('GET', `/api/doctor/${doctorA.id}`)
    check('Single doctor page data works', result.status === 200 && result.data.doctor?.fees === 600)
    result = await api('GET', '/api/hospital/list')
    check('Hospital list shows the doctor count', (result.data.hospitals || []).find(h => h._id === hospitalId)?.doctorCount === 1)
    result = await api('GET', `/api/hospital/${hospitalId}`)
    check('Hospital page lists its doctors', result.status === 200 && result.data.doctors?.length === 1)
    result = await api('GET', '/api/public/stats')
    check('Public statistics come from the database', result.status === 200 && result.data.stats?.doctors >= 1 && result.data.stats?.patients >= 2, result.data)

    // ---------------------------------------------------------------
    section('3. Time slots')

    let slots = await getSlots(doctorA.id, tomorrow)
    check('09:00-12:00 with 30 minute slots gives 6 slots', slots.length === 6, slots.map(s => s.time).join(','))
    check('All slots are free at the start', slots.every(slot => slot.available))
    result = await api('GET', `/api/doctor/${doctorA.id}/slots?date=${addDays(today, -1)}`)
    check('Past date is rejected (400)', result.status === 400)
    result = await api('GET', `/api/doctor/${doctorA.id}/slots?date=${addDays(today, 31)}`)
    check('More than 30 days ahead is rejected (400)', result.status === 400)

    // ---------------------------------------------------------------
    section('4. Booking and double-booking protection')

    result = await book(patient1, doctorA.id, tomorrow, '09:00', { amount: 1, reason: 'Fever' })
    const appointment1 = result.data.appointment
    check('Patient 1 books 09:00 (201)', result.status === 201 && !!appointment1, result.data)
    check('New appointment starts as Pending', appointment1?.status === 'Pending')
    check('Fee comes from the doctor (600), not from the request (1)', appointment1?.amount === 600)
    check('That slot is now shown as taken', !(await isSlotFree(doctorA.id, tomorrow, '09:00')))

    result = await book(patient2, doctorA.id, tomorrow, '09:00')
    check('Patient 2 cannot book the same slot (409)', result.status === 409, result.data)

    result = await book(patient2, doctorA.id, tomorrow, '09:15')
    check('A time that is not a real slot is rejected (400)', result.status === 400)

    result = await book(patient1, doctorA.id, tomorrow, '10:00')
    check('Same patient, same doctor, same day is rejected (409)', result.status === 409)

    result = await book(patient1, doctorA.id, '26 Sep 2026', '10:00 AM')
    check('The old date format is rejected (400)', result.status === 400)

    result = await book(patient1, doctorA.id, addDays(today, -1), '10:00')
    check('Booking a past date is rejected (400)', result.status === 400)

    // two patients pressing "book" at the same moment: exactly one must win
    const race = await Promise.all([
        book(patient1, doctorA.id, addDays(today, 2), '09:00'),
        book(patient2, doctorA.id, addDays(today, 2), '09:00')
    ])
    const wins = race.filter(item => item.status === 201).length
    check('Two simultaneous bookings: exactly one succeeds', wins === 1 && race.some(item => item.status === 409), race.map(r => r.status))

    check('Doctor was notified of the request', await hasNotification(doctorA.token, 'FullCheck Patient p1'))
    check('Patient was notified that the request was sent', await hasNotification(patient1.token, 'Appointment requested'))

    // ---------------------------------------------------------------
    section('5. Doctor accepts, rejects and completes')

    result = await api('GET', '/api/doctor/appointments?status=Pending', null, doctorA.token)
    check('Doctor sees the request with the patient name', (result.data.appointments || []).some(item => item._id === appointment1._id && item.userId?.name === 'FullCheck Patient p1'), result.data)

    result = await api('PUT', `/api/doctor/appointments/${appointment1._id}/status`, { status: 'Completed' }, doctorA.token)
    check('A Pending appointment cannot jump to Completed (400)', result.status === 400)

    result = await api('PUT', `/api/doctor/appointments/${appointment1._id}/status`, { status: 'Confirmed' }, patient1.token)
    check('A patient cannot confirm (403)', result.status === 403)

    result = await api('PUT', `/api/doctor/appointments/${appointment1._id}/status`, { status: 'Confirmed' }, doctorA.token)
    check('Doctor confirms (200)', result.status === 200, result.data)
    check('Patient was notified of the confirmation', await hasNotification(patient1.token, 'confirmed your appointment'))

    result = await api('PUT', `/api/doctor/appointments/${appointment1._id}/status`, { status: 'Completed' }, doctorA.token)
    check('A future appointment cannot be completed (400)', result.status === 400)

    result = await book(patient2, doctorA.id, tomorrow, '09:30')
    const appointment2 = result.data.appointment
    result = await api('PUT', `/api/doctor/appointments/${appointment2._id}/status`, { status: 'Rejected', note: 'On leave that morning' }, doctorA.token)
    check('Doctor rejects with a reason (200)', result.status === 200)
    check('Patient was told the reason', await hasNotification(patient2.token, 'On leave that morning'))
    check('A rejected slot is free again', await isSlotFree(doctorA.id, tomorrow, '09:30'))

    result = await api('PUT', `/api/doctor/appointments/${appointment2._id}/status`, { status: 'Confirmed' }, doctorA.token)
    check('A rejected appointment cannot be confirmed later (400)', result.status === 400)

    result = await book(patient2, doctorA.id, tomorrow, '09:30')
    const appointment3 = result.data.appointment
    check('Patient 2 books the freed slot (201)', result.status === 201)

    // ---------------------------------------------------------------
    section('6. Reschedule')

    result = await api('PUT', '/api/appointment/reschedule', { appointmentId: appointment1._id, date: tomorrow, time: '09:00' }, patient1.token)
    check('Rescheduling to the same time is rejected (400)', result.status === 400)

    result = await api('PUT', '/api/appointment/reschedule', { appointmentId: appointment1._id, date: tomorrow, time: '09:30' }, patient1.token)
    check('Rescheduling to a taken slot is rejected (409)', result.status === 409)

    result = await api('PUT', '/api/appointment/reschedule', { appointmentId: appointment1._id, date: tomorrow, time: '10:30' }, patient1.token)
    check('Patient reschedules to 10:30 (200)', result.status === 200, result.data)
    check('After the patient moves it, it needs confirmation again', result.data.appointment?.status === 'Pending' && result.data.appointment?.rescheduleCount === 1)
    check('The old slot is free again', await isSlotFree(doctorA.id, tomorrow, '09:00'))
    check('Doctor was notified of the reschedule', await hasNotification(doctorA.token, 'rescheduled by patient'))

    await api('PUT', `/api/doctor/appointments/${appointment1._id}/status`, { status: 'Confirmed' }, doctorA.token)
    result = await api('PUT', `/api/doctor/appointments/${appointment1._id}/reschedule`, { date: tomorrow, time: '11:00' }, doctorA.token)
    check('Doctor reschedules to 11:00 (200)', result.status === 200, result.data)
    check('A doctor-made change stays Confirmed', result.data.appointment?.status === 'Confirmed')
    check('Patient was notified', await hasNotification(patient1.token, 'moved your appointment'))

    // ---------------------------------------------------------------
    section('7. Cancel')

    result = await api('PUT', '/api/appointment/cancel', { appointmentId: appointment3._id }, patient1.token)
    check("A patient cannot cancel someone else's appointment (404)", result.status === 404)

    result = await api('PUT', '/api/appointment/cancel', { appointmentId: appointment1._id }, patient1.token)
    check('Patient cancels (200)', result.status === 200)
    check('Cancelled slot is free again', await isSlotFree(doctorA.id, tomorrow, '11:00'))
    check('Doctor was notified of the cancellation', await hasNotification(doctorA.token, 'cancelled the appointment'))

    result = await api('PUT', '/api/appointment/cancel', { appointmentId: appointment1._id }, patient1.token)
    check('Cancelling twice is rejected (400)', result.status === 400)

    result = await api('PUT', `/api/doctor/appointments/${appointment1._id}/reschedule`, { date: tomorrow, time: '11:30' }, doctorA.token)
    check('A cancelled appointment cannot be rescheduled (400)', result.status === 400)

    result = await api('GET', '/api/appointment/my-appointments', null, patient1.token)
    const mine = (result.data.appointments || []).find(item => item._id === appointment1._id)
    check('My appointments shows the doctor with hospital', mine?.doctorId?.hospitalId?.name === 'FullCheck City Hospital', mine?.doctorId)
    check('My appointments never leaks the doctor password', mine && !('password' in (mine.doctorId || {})))

    // ---------------------------------------------------------------
    section('8. Doctors who register themselves (admin approval)')

    const newDoctor = { name: 'FullCheck Dr C', email: emailOf('docC'), password, speciality: 'Dermatologist', degree: 'MD', experience: '3 Years', fees: 400 }

    result = await api('POST', '/api/doctor/register', newDoctor)
    check('Registration needs hospital or clinic details (400)', result.status === 400)

    result = await api('POST', '/api/doctor/register', { ...newDoctor, hospitalId: 'abc' })
    check('Registration with an invalid hospital is rejected (400)', result.status === 400)

    result = await api('POST', '/api/doctor/register', { ...newDoctor, clinic: { name: 'FullCheck Skin Clinic', type: 'Independent Clinic', city: 'Testville' } })
    check('Doctor C registers with a new clinic (201)', result.status === 201, result.data)
    const doctorCId = result.data.doctorId

    result = await api('POST', '/api/doctor/register', { ...newDoctor, clinic: { name: 'FullCheck Skin Clinic 2' } })
    check('Registering the same email again is rejected (409)', result.status === 409)
    check('The failed registration did not leave an unused clinic behind', (await hospitalModel.countDocuments({ name: 'FullCheck Skin Clinic 2' })) === 0)

    result = await api('POST', '/api/doctor/login', { email: newDoctor.email, password })
    const doctorC = { token: result.data.token }
    check('A pending doctor can login and sees "pending"', result.status === 200 && result.data.approvalStatus === 'pending', result.data)

    result = await api('GET', '/api/doctor/dashboard', null, doctorC.token)
    check('A pending doctor cannot open the dashboard (403)', result.status === 403 && /approval/.test(result.data.message || ''), result.data)

    result = await api('GET', '/api/doctor/profile', null, doctorC.token)
    check('A pending doctor can still see their own profile', result.status === 200 && result.data.doctor?.approvalStatus === 'pending')

    result = await api('GET', '/api/doctor/list')
    check('A pending doctor is NOT in the public list', !(result.data.doctors || []).some(doctor => doctor._id === doctorCId))
    result = await api('GET', `/api/doctor/${doctorCId}`)
    check('A pending doctor page returns 404', result.status === 404)
    result = await book(patient1, doctorCId, tomorrow, '10:00')
    check('A pending doctor cannot be booked (404)', result.status === 404)

    result = await api('GET', '/api/admin/doctors?status=pending&search=FullCheck', null, adminToken)
    check('Admin sees the pending doctor', (result.data.doctors || []).some(doctor => doctor._id === doctorCId) && result.data.pendingCount >= 1, result.data)
    check('Admin was notified of the registration', await hasNotification(adminToken, 'FullCheck Dr C'))

    result = await api('GET', '/api/hospital/list')
    check("The doctor's new clinic is hidden until approval", !(result.data.hospitals || []).some(h => h.name === 'FullCheck Skin Clinic'))

    result = await api('PUT', `/api/admin/doctors/${doctorCId}/approval`, { status: 'maybe' }, adminToken)
    check('Wrong approval status is rejected (400)', result.status === 400)

    result = await api('PUT', `/api/admin/doctors/${doctorCId}/approval`, { status: 'approved' }, adminToken)
    check('Admin approves doctor C (200)', result.status === 200)

    result = await api('GET', '/api/doctor/list')
    check('Doctor C is now in the public list', (result.data.doctors || []).some(doctor => doctor._id === doctorCId))
    result = await api('GET', '/api/hospital/list')
    check("Doctor C's clinic is now visible", (result.data.hospitals || []).some(h => h.name === 'FullCheck Skin Clinic'))
    check('Doctor C was notified of the approval', await hasNotification(doctorC.token, 'approved'))

    result = await api('GET', '/api/doctor/dashboard', null, doctorC.token)
    check('Doctor C can now open the dashboard', result.status === 200 && result.data.stats?.total === 0, result.data)

    // a doctor who gets rejected
    await api('POST', '/api/doctor/register', { ...newDoctor, name: 'FullCheck Dr D', email: emailOf('docD'), hospitalId })
    const pendingD = await doctorModel.findOne({ email: emailOf('docD') })
    result = await api('PUT', `/api/admin/doctors/${pendingD._id}/approval`, { status: 'rejected', note: 'Documents missing' }, adminToken)
    check('Admin rejects doctor D with a reason', result.status === 200)
    result = await api('POST', '/api/doctor/login', { email: emailOf('docD'), password })
    result = await api('GET', '/api/doctor/dashboard', null, result.data.token)
    check('A rejected doctor cannot open the dashboard (403)', result.status === 403 && /rejected/.test(result.data.message || ''))
    result = await api('GET', '/api/doctor/list')
    check('A rejected doctor is not public', !(result.data.doctors || []).some(doctor => doctor._id === String(pendingD._id)))

    // ---------------------------------------------------------------
    section('9. Clinic queue, waiting time and reliability (doctor B)')

    result = await api('POST', '/api/doctor/add', { ...doctorFields, name: 'FullCheck Dr B', email: emailOf('docB'), fees: 500 }, adminToken)
    const doctorB = { id: result.data.doctor?._id }
    result = await api('POST', '/api/doctor/login', { email: emailOf('docB'), password })
    doctorB.token = result.data.token
    await api('PUT', '/api/doctor/availability', { availability: everyDay('00:00', '23:45'), slotDuration: 15 }, doctorB.token)

    const queuePatients = [patient1, patient2, await makePatient('p3'), await makePatient('p4')]
    const todaySlots = (await getSlots(doctorB.id, today)).filter(slot => slot.available).slice(2, 6)

    if (todaySlots.length < 4) {
        check('Enough slots left today for the queue test (run it earlier in the day)', false, `only ${todaySlots.length}`)
    } else {
        const todaysAppointments = []

        for (let i = 0; i < 4; i++) {
            const booking = await book(queuePatients[i], doctorB.id, today, todaySlots[i].time)
            todaysAppointments.push(booking.data.appointment)
            await api('PUT', `/api/doctor/appointments/${booking.data.appointment._id}/status`, { status: 'Confirmed' }, doctorB.token)
        }

        check('Four patients are booked and confirmed for today', todaysAppointments.every(Boolean))

        result = await api('GET', `/api/appointment/queue/${todaysAppointments[1]._id}`, null, queuePatients[1].token)
        check('Patient 2 is 2nd in the queue with 1 patient ahead', result.data.queue?.position === 2 && result.data.queue?.patientsAhead === 1, result.data)
        check('Estimated wait = 1 patient x 15 minutes', result.data.queue?.estimatedWaitMinutes === 15)

        result = await api('GET', '/api/doctor/queue', null, doctorB.token)
        check("The doctor's queue lists 4 patients in time order", result.data.queue?.length === 4 && result.data.queue[0].position === 1 && result.data.queue[3].estimatedWaitMinutes === 45, result.data)

        result = await api('PUT', `/api/doctor/appointments/${todaysAppointments[0]._id}/queue`, { queueStatus: 'In consultation' }, doctorB.token)
        check('Doctor starts with patient 1 (200)', result.status === 200)
        check('Patient 1 is told it is their turn', await hasNotification(queuePatients[0].token, 'your turn'))

        result = await api('PUT', `/api/doctor/appointments/${todaysAppointments[1]._id}/queue`, { queueStatus: 'In consultation' }, doctorB.token)
        check('A second consultation cannot start before the first ends (409)', result.status === 409)

        result = await api('PUT', `/api/doctor/appointments/${todaysAppointments[0]._id}/queue`, { queueStatus: 'Done' }, doctorB.token)
        check('Patient 1 marked Done (200)', result.status === 200)

        result = await api('GET', '/api/appointment/my-appointments', null, queuePatients[0].token)
        const done = (result.data.appointments || []).find(item => item._id === todaysAppointments[0]._id)
        check('Done also sets the appointment to Completed', done?.status === 'Completed')

        result = await api('GET', `/api/appointment/queue/${todaysAppointments[0]._id}`, null, queuePatients[0].token)
        check('A finished patient is no longer in the queue', result.data.inQueue === false)

        result = await api('GET', `/api/appointment/queue/${todaysAppointments[1]._id}`, null, queuePatients[1].token)
        check('Patient 2 moves up: position 1, no wait', result.data.queue?.position === 1 && result.data.queue?.estimatedWaitMinutes === 0, result.data)

        // reliability: 1 completed so far, complete 3 more -> 4 records, still hidden
        for (let i = 1; i < 4; i++) {
            await api('PUT', `/api/doctor/appointments/${todaysAppointments[i]._id}/status`, { status: 'Completed' }, doctorB.token)
        }

        result = await api('GET', `/api/doctor/${doctorB.id}`)
        check('With 4 finished appointments reliability is still hidden', result.data.doctor?.reliability?.percent === null && result.data.doctor?.reliability?.total === 4, result.data.doctor?.reliability)

        // a 5th record: the doctor cancels a confirmed appointment
        const patient5 = await makePatient('p5')
        result = await book(patient5, doctorB.id, tomorrow, '10:00')
        const lastAppointment = result.data.appointment
        await api('PUT', `/api/doctor/appointments/${lastAppointment._id}/status`, { status: 'Confirmed' }, doctorB.token)
        result = await api('PUT', `/api/doctor/appointments/${lastAppointment._id}/status`, { status: 'Cancelled', note: 'Emergency surgery' }, doctorB.token)
        check('Doctor cancels a confirmed appointment (200)', result.status === 200)
        check('Patient was told the doctor cancelled', await hasNotification(patient5.token, 'Emergency surgery'))

        result = await api('GET', `/api/doctor/${doctorB.id}`)
        check('With 5 records reliability is 80% (4 completed, 1 cancelled by doctor)', result.data.doctor?.reliability?.percent === 80, result.data.doctor?.reliability)

        result = await api('GET', '/api/doctor/dashboard', null, doctorB.token)
        check('Doctor dashboard: 4 completed, 1 cancelled, earnings 4 x 500', result.data.stats?.completed === 4 && result.data.stats?.cancelled === 1 && result.data.stats?.earnings === 2000, result.data.stats)
        check('Doctor dashboard has a 7-day chart', result.data.chart?.length === 7)
    }

    // ---------------------------------------------------------------
    section('10. Admin management')

    result = await api('GET', '/api/admin/dashboard', null, adminToken)
    const stats = result.data.stats || {}
    const sumOfStatuses = Object.values(stats.statusCounts || {}).reduce((sum, number) => sum + number, 0)
    check('Dashboard: status counts add up to the total', result.status === 200 && sumOfStatuses === stats.totalAppointments, stats)
    check('Dashboard has a 7-day chart and recent appointments', result.data.chart?.length === 7 && Array.isArray(result.data.recentAppointments))

    result = await api('GET', '/api/admin/appointments?search=FullCheck&status=Cancelled', null, adminToken)
    check('Admin can search and filter appointments', result.status === 200 && result.data.total >= 1 && result.data.appointments.every(item => item.status === 'Cancelled'), result.data.total)

    result = await api('PUT', `/api/admin/appointments/${appointment3._id}/cancel`, { note: 'Clinic closed' }, adminToken)
    check('Admin cancels an appointment (200)', result.status === 200)
    check('Patient was notified of the admin cancellation', await hasNotification(patient2.token, 'Clinic closed'))
    check("Doctor was notified of the admin cancellation", await hasNotification(doctorA.token, 'cancelled by the admin'))

    result = await api('GET', '/api/admin/patients?search=FullCheck Patient', null, adminToken)
    check('Admin lists patients with appointment counts', result.data.total >= 5 && typeof result.data.patients?.[0]?.appointmentCount === 'number' && !('password' in result.data.patients[0]), result.data.total)

    result = await api('PUT', `/api/admin/patients/${patient2.id}/block`, { blocked: true }, adminToken)
    check('Admin blocks patient 2 (200)', result.status === 200)
    result = await api('POST', '/api/user/login', { email: patient2.email, password })
    check('A blocked patient cannot login (403)', result.status === 403)
    result = await book(patient2, doctorA.id, tomorrow, '10:00')
    check('A blocked patient cannot book (403)', result.status === 403)
    result = await api('GET', '/api/user/profile', null, patient2.token)
    check('A blocked patient is refused on the profile (403) so the website logs them out', result.status === 403)
    await api('PUT', `/api/admin/patients/${patient2.id}/block`, { blocked: false }, adminToken)
    result = await api('POST', '/api/user/login', { email: patient2.email, password })
    check('After unblocking, login works again', result.status === 200)

    // an active appointment protects the doctor from being deleted
    result = await book(patient1, doctorA.id, tomorrow, '09:00')
    const activeAppointment = result.data.appointment
    result = await api('DELETE', `/api/admin/doctors/${doctorA.id}`, null, adminToken)
    check('A doctor with active appointments cannot be deleted (409)', result.status === 409, result.data)
    await api('PUT', '/api/appointment/cancel', { appointmentId: activeAppointment._id }, patient1.token)

    result = await api('DELETE', `/api/admin/hospitals/${hospitalId}`, null, adminToken)
    check('A hospital that still has doctors cannot be deleted (409)', result.status === 409)

    result = await api('PUT', `/api/admin/doctors/${doctorA.id}`, { fees: 650, available: true }, adminToken)
    check('Admin edits a doctor (200)', result.status === 200)
    result = await api('GET', `/api/doctor/${doctorA.id}`)
    check('The new fee is visible to patients', result.data.doctor?.fees === 650)

    result = await api('GET', '/api/admin/messages', null, adminToken)
    check('Admin can read contact messages', result.status === 200 && Array.isArray(result.data.messages))

    // ---------------------------------------------------------------
    section('11. Notifications')

    let notifications = await notificationsOf(patient1.token)
    check('Patient 1 has unread notifications', notifications.unreadCount > 0, notifications.unreadCount)

    const firstId = notifications.notifications[0]._id
    await api('PUT', `/api/notification/read/${firstId}`, null, patient2.token)
    const afterStranger = await notificationsOf(patient1.token)
    check("Another person cannot mark my notification as read", afterStranger.unreadCount === notifications.unreadCount)

    await api('PUT', `/api/notification/read/${firstId}`, null, patient1.token)
    const afterOwn = await notificationsOf(patient1.token)
    check('Marking one as read lowers the unread count by 1', afterOwn.unreadCount === notifications.unreadCount - 1)

    await api('PUT', '/api/notification/read-all', null, patient1.token)
    check('Mark all as read gives 0 unread', (await notificationsOf(patient1.token)).unreadCount === 0)

    // ---------------------------------------------------------------
    section('12. Refunds and payment')

    const payer = await makePatient('p6')
    result = await book(payer, doctorA.id, tomorrow, '09:00')
    const paidAppointment = result.data.appointment

    result = await api('GET', '/api/payment/status')
    const paymentEnabled = result.data.enabled === true

    if (paymentEnabled) {
        const orderId = 'order_fullcheck'
        await appointmentModel.findByIdAndUpdate(paidAppointment._id, { paymentOrderId: orderId })

        result = await api('POST', '/api/payment/verify', { appointmentId: paidAppointment._id, razorpay_order_id: orderId, razorpay_payment_id: 'pay_fake', razorpay_signature: 'f'.repeat(64) }, payer.token)
        check('A fake payment signature is rejected (400)', result.status === 400)

        const goodSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|pay_real`).digest('hex')
        result = await api('POST', '/api/payment/verify', { appointmentId: paidAppointment._id, razorpay_order_id: orderId, razorpay_payment_id: 'pay_real', razorpay_signature: goodSignature }, payer.token)
        check('A correct signature marks the appointment Paid', result.status === 200, result.data)
    } else {
        result = await api('POST', '/api/payment/create-order', { appointmentId: paidAppointment._id }, payer.token)
        check('Without Razorpay keys, online payment answers 503 (pay at clinic)', result.status === 503)
        console.log('        (add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET test keys to .env to also check the signature flow)')
        await appointmentModel.findByIdAndUpdate(paidAppointment._id, { paymentStatus: 'Paid' })
    }

    await api('PUT', '/api/appointment/cancel', { appointmentId: paidAppointment._id }, payer.token)
    let paidDoc = await appointmentModel.findById(paidAppointment._id)
    check('Cancelling a paid appointment marks the refund as pending', paidDoc.paymentStatus === 'Refund pending', paidDoc.paymentStatus)

    result = await api('PUT', `/api/admin/appointments/${paidAppointment._id}/refund`, null, adminToken)
    paidDoc = await appointmentModel.findById(paidAppointment._id)
    check('Admin marks the refund as done', result.status === 200 && paidDoc.paymentStatus === 'Refunded')
    result = await api('PUT', `/api/admin/appointments/${paidAppointment._id}/refund`, null, adminToken)
    check('A refund cannot be done twice (400)', result.status === 400)

    // ---------------------------------------------------------------
    section('13. Assistant')

    result = await api('POST', '/api/assistant/chat', { message: 'I have a skin rash and itching' })
    check('Symptom question suggests Dermatologist with a real doctor count', result.data.suggestions?.[0]?.speciality === 'Dermatologist' && typeof result.data.suggestions[0].doctorCount === 'number' && result.data.suggestions[0].doctorCount >= 1, result.data)
    check('The answer includes the "not a doctor" disclaimer', /not a doctor/.test(result.data.disclaimer || ''))
    result = await api('POST', '/api/assistant/chat', { message: 'severe chest pain' })
    check('Emergency answer points to 112', result.data.type === 'emergency' && /112/.test(result.data.reply))
    result = await api('POST', '/api/assistant/chat', { message: '' })
    check('Empty question is rejected (400)', result.status === 400)

    // ---------------------------------------------------------------
    section('14. Photos')

    result = await api('PUT', '/api/user/image', null, patient1.token)
    check('No file is rejected (400)', result.status === 400)

    result = await api('PUT', '/api/user/image', imageForm(Buffer.from('not an image'), 'text/plain', 'x.txt'), patient1.token)
    check('A text file is rejected (400)', result.status === 400, result.data)

    result = await api('PUT', '/api/user/image', imageForm(Buffer.alloc(2.5 * 1024 * 1024), 'image/png', 'big.png'), patient1.token)
    check('A file bigger than 2 MB is rejected (400)', result.status === 400, result.data)

    result = await api('PUT', '/api/user/image', imageForm(tinyPng, 'image/png', 'me.png'), patient1.token)
    check('A PNG is accepted (200)', result.status === 200 && /^\/uploads\//.test(result.data.image || ''), result.data)
    if (result.data.image) {
        uploadedFiles.push(result.data.image)
        const fileResponse = await fetch(BASE + result.data.image)
        check('The uploaded photo can be opened in the browser', fileResponse.status === 200 && /image\/png/.test(fileResponse.headers.get('content-type') || ''))
    }

    result = await api('PUT', '/api/doctor/image', imageForm(tinyPng, 'image/png', 'doc.png'), doctorA.token)
    check('A doctor can upload a photo (200)', result.status === 200)
    if (result.data.image) uploadedFiles.push(result.data.image)

    result = await api('PUT', `/api/admin/doctors/${doctorA.id}/image`, imageForm(tinyPng, 'image/png', 'doc2.png'), adminToken)
    check('Admin can upload a doctor photo (200)', result.status === 200)
    if (result.data.image) uploadedFiles.push(result.data.image)

    // ---------------------------------------------------------------
    section('15. Data saved before this update still works')

    const legacyDoctor = await doctorModel.collection.insertOne({
        name: 'FullCheck Legacy Doctor',
        email: emailOf('legacy'),
        password: 'x',
        speciality: 'General physician',
        fees: 300,
        available: true,
        image: '',
        address: { line1: 'Old Clinic', line2: 'Old City' }
    })

    result = await api('GET', '/api/doctor/list')
    const legacyListed = (result.data.doctors || []).find(doctor => doctor._id === String(legacyDoctor.insertedId))
    check('An old doctor (no approval or hours saved) is still public', !!legacyListed)
    check('An old doctor gets the default working hours (Mon-Sat 10:00-17:00)', legacyListed?.availability?.length === 6)

    const workingDate = [tomorrow, addDays(today, 2)].find(date => getDayOfWeek(date) !== 0)
    result = await book(patient1, String(legacyDoctor.insertedId), workingDate, '10:00')
    check('An old doctor can be booked (201)', result.status === 201, result.data)

    await appointmentModel.create({ userId: patient1.id, doctorId: legacyDoctor.insertedId, date: '26 Sep 2026', time: '10:00 AM', status: 'Confirmed', amount: 300 })
    result = await api('GET', '/api/appointment/my-appointments', null, patient1.token)
    const oldFormat = (result.data.appointments || []).find(item => item.date === '26 Sep 2026')
    check('An old appointment (old date format) is still listed', result.status === 200 && !!oldFormat)
    result = await api('PUT', '/api/appointment/cancel', { appointmentId: oldFormat?._id }, patient1.token)
    check('An old appointment can still be cancelled', result.status === 200)
}

// =====================================================================
const cleanUp = async () => {

    await mongoose.connect(process.env.MONGODB_URI)

    const users = await userModel.find({ email: /^full-check-/ }).select('_id')
    const doctors = await doctorModel.find({ email: /^full-check-/ }).select('_id')

    const userIds = users.map(item => item._id)
    const doctorIds = doctors.map(item => item._id)

    await appointmentModel.deleteMany({ $or: [{ userId: { $in: userIds } }, { doctorId: { $in: doctorIds } }] })
    await notificationModel.deleteMany({
        $or: [
            { recipientId: { $in: [...userIds, ...doctorIds] } },
            { message: /FullCheck/ }
        ]
    })
    await userModel.deleteMany({ email: /^full-check-/ })
    await doctorModel.deleteMany({ email: /^full-check-/ })
    await hospitalModel.deleteMany({ name: /^FullCheck/ })

    for (const file of uploadedFiles) {
        fs.rmSync(path.join(uploadFolder, path.basename(file)), { force: true })
    }

    await mongoose.disconnect()
    console.log('\nTest data deleted.')
}

try {
    await run()
} catch (error) {
    failed++
    console.log('\nStopped early. Is the server running?', error)
}

await cleanUp().catch(error => console.log('Clean-up failed:', error.message))

console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
