// Checks the Stage 1 backend features against a RUNNING server.
//
// 1. Start the server in one terminal:   npm run server
// 2. Run this in another terminal:       npm run check:stage1
//
// It creates a few test records (their emails start with "stage1-check-")
// and deletes them again at the end.

import 'dotenv/config'
import mongoose from 'mongoose'
import userModel from '../models/userModel.js'
import doctorModel from '../models/doctorModel.js'
import appointmentModel from '../models/appointmentModel.js'

const BASE = `http://localhost:${process.env.PORT || 4000}`
const stamp = Date.now()

const patientEmail = `stage1-check-patient-${stamp}@test.com`
const doctorEmail = `stage1-check-doctor-${stamp}@test.com`
const password = 'TestPass123'
const doctorFees = 500

let passed = 0
let failed = 0

// Sends a request and returns { status, data }
const callApi = async (method, path, body, token) => {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.token = token

    const response = await fetch(BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    })

    const data = await response.json().catch(() => ({}))
    return { status: response.status, data }
}

// Prints one result line
const check = (title, condition, extra = '') => {
    if (condition) {
        passed++
        console.log(`  PASS  ${title}`)
    } else {
        failed++
        console.log(`  FAIL  ${title} ${extra}`)
    }
}

const run = async () => {

    console.log(`\nChecking server at ${BASE}\n`)

    let result

    console.log('Server')
    result = await callApi('GET', '/nothing-here')
    check('Unknown route returns 404', result.status === 404)

    console.log('\nPatient register and login')
    result = await callApi('POST', '/api/user/register', { name: 'Test', email: patientEmail, password: '123' })
    check('Short password is rejected (400)', result.status === 400)

    result = await callApi('POST', '/api/user/register', { name: 'Test', email: 'not-an-email', password })
    check('Invalid email is rejected (400)', result.status === 400)

    result = await callApi('POST', '/api/user/register', { name: 'Test', email: patientEmail, password })
    check('Valid registration works (201)', result.status === 201, JSON.stringify(result.data))

    result = await callApi('POST', '/api/user/register', { name: 'Test', email: patientEmail.toUpperCase(), password })
    check('Same email in capital letters is rejected as duplicate (409)', result.status === 409)

    result = await callApi('POST', '/api/user/login', { email: patientEmail, password: 'wrong-password' })
    check('Wrong password is rejected (401)', result.status === 401)

    result = await callApi('POST', '/api/user/login', { email: patientEmail, password })
    const patientToken = result.data.token
    check('Login works and returns a token', result.status === 200 && !!patientToken)

    console.log('\nPatient profile')
    result = await callApi('GET', '/api/user/profile')
    check('Profile without token is rejected (401)', result.status === 401)

    result = await callApi('GET', '/api/user/profile', null, patientToken)
    check('Profile with token works', result.status === 200 && result.data.user?.email === patientEmail)
    check('Profile does not contain the password', result.data.user && !('password' in result.data.user))

    result = await callApi('PUT', '/api/user/update-profile', { phone: 'abc' }, patientToken)
    check('Invalid phone number is rejected (400)', result.status === 400)

    console.log('\nAdmin')
    result = await callApi('POST', '/api/doctor/add', { name: 'X' })
    check('Add doctor without token is rejected (401)', result.status === 401)

    result = await callApi('POST', '/api/doctor/add', { name: 'X' }, patientToken)
    check('Add doctor with a patient token is rejected (403)', result.status === 403)

    result = await callApi('POST', '/api/admin/login', { email: process.env.ADMIN_EMAIL, password: 'wrong-password' })
    check('Admin login with wrong password is rejected (401)', result.status === 401)

    result = await callApi('POST', '/api/admin/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    const adminToken = result.data.token
    check('Admin login works (did you run npm run seed:admin?)', result.status === 200 && !!adminToken, JSON.stringify(result.data))

    result = await callApi('POST', '/api/user/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    check('Admin cannot use the patient login (401)', result.status === 401)

    result = await callApi('POST', '/api/doctor/add', { name: 'Dr Test' }, adminToken)
    check('Add doctor with missing fields is rejected (400)', result.status === 400)

    const newDoctor = {
        name: 'Dr. Stage One',
        email: doctorEmail,
        password,
        speciality: 'General physician',
        degree: 'MBBS',
        experience: '5 Years',
        fees: doctorFees,
        address: { line1: 'Test Clinic', line2: 'Test City' }
    }

    result = await callApi('POST', '/api/doctor/add', newDoctor, adminToken)
    const doctorId = result.data.doctor?._id
    check('Admin can add a doctor (201)', result.status === 201 && !!doctorId, JSON.stringify(result.data))
    check('Added doctor response has no password', result.data.doctor && !('password' in result.data.doctor))

    result = await callApi('POST', '/api/doctor/add', newDoctor, adminToken)
    check('Adding the same doctor again is rejected (409)', result.status === 409)

    console.log('\nDoctor login')
    result = await callApi('POST', '/api/doctor/login', { email: doctorEmail, password: 'wrong-password' })
    check('Doctor login with wrong password is rejected (401)', result.status === 401)

    result = await callApi('POST', '/api/doctor/login', { email: doctorEmail, password })
    const doctorToken = result.data.token
    check('Doctor login works', result.status === 200 && !!doctorToken)

    result = await callApi('GET', '/api/doctor/profile', null, doctorToken)
    check('Doctor can see own profile', result.status === 200 && result.data.doctor?.email === doctorEmail)

    result = await callApi('GET', '/api/doctor/profile', null, patientToken)
    check('Patient token cannot open doctor profile (403)', result.status === 403)

    result = await callApi('GET', '/api/appointment/my-appointments', null, doctorToken)
    check('Doctor token cannot open patient appointments (403)', result.status === 403)

    console.log('\nBooking')
    const slot = { date: '2030-01-15', time: '10:00 AM' }

    result = await callApi('POST', '/api/appointment/book', { doctorId: 'abc', ...slot }, patientToken)
    check('Invalid doctor id is rejected (400)', result.status === 400)

    result = await callApi('POST', '/api/appointment/book', { doctorId: '507f1f77bcf86cd799439011', ...slot }, patientToken)
    check('Unknown doctor is rejected (404)', result.status === 404)

    result = await callApi('POST', '/api/appointment/book', { doctorId, ...slot, amount: 1 }, patientToken)
    const appointmentId = result.data.appointment?._id
    check('Booking works (201)', result.status === 201 && !!appointmentId, JSON.stringify(result.data))
    check(`Fee comes from the doctor (${doctorFees}), not from the request (1)`, result.data.appointment?.amount === doctorFees)

    result = await callApi('POST', '/api/appointment/book', { doctorId, ...slot }, patientToken)
    check('Booking the same slot again is rejected (409)', result.status === 409)

    result = await callApi('PUT', '/api/appointment/cancel', { appointmentId }, patientToken)
    check('Cancel works', result.status === 200)

    result = await callApi('PUT', '/api/appointment/cancel', { appointmentId }, patientToken)
    check('Cancelling twice is rejected (400)', result.status === 400)

    result = await callApi('POST', '/api/appointment/book', { doctorId, ...slot }, patientToken)
    check('A cancelled slot can be booked again (201)', result.status === 201)

    result = await callApi('GET', '/api/appointment/my-appointments', null, patientToken)
    const listedDoctor = result.data.appointments?.[0]?.doctorId
    check('My appointments works', result.status === 200 && result.data.appointments?.length === 2)
    check('Doctor password hash is not leaked in appointments', listedDoctor && !('password' in listedDoctor))

    console.log('\nContact form')
    result = await callApi('POST', '/api/contact/submit', { name: 'T', email: 'bad', phone: '1', subject: 'S', message: 'M' })
    check('Contact form with invalid email is rejected (400)', result.status === 400)
}

const cleanUp = async () => {
    await mongoose.connect(process.env.MONGODB_URI)

    const testUsers = await userModel.find({ email: /^stage1-check-/ })
    const testDoctors = await doctorModel.find({ email: /^stage1-check-/ })

    await appointmentModel.deleteMany({
        $or: [
            { userId: { $in: testUsers.map(user => user._id) } },
            { doctorId: { $in: testDoctors.map(doctor => doctor._id) } }
        ]
    })
    await userModel.deleteMany({ email: /^stage1-check-/ })
    await doctorModel.deleteMany({ email: /^stage1-check-/ })

    await mongoose.disconnect()
    console.log('\nTest data deleted.')
}

try {
    await run()
} catch (error) {
    failed++
    console.log('\nCould not finish. Is the server running?', error.message)
}

await cleanUp().catch(error => console.log('Clean-up failed:', error.message))

console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
