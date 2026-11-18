import doctorModel from '../models/doctorModel.js'
import hospitalModel from '../models/hospitalModel.js'
import userModel from '../models/userModel.js'
import appointmentModel from '../models/appointmentModel.js'
import contactModel from '../models/contactModel.js'
import bcrypt from 'bcryptjs'
import {
    isValidId,
    isValidPassword,
    isValidPhone
} from '../utils/validators.js'
import { canChangeStatus } from '../utils/appointmentRules.js'
import { changeStatus } from '../utils/appointmentActions.js'
import { ACTIVE_STATUSES, HOSPITAL_TYPES } from '../utils/constants.js'
import { escapeRegex, getPagination } from '../utils/pagination.js'
import { hospitalFields, getReliabilityMap, toDoctorResponse } from '../utils/doctorHelpers.js'
import { notifyDoctorByEmail, notifyPatient, notifyDoctor, formatSlot } from '../utils/notify.js'

// All these routes are protected by authAdmin (see adminRoute.js)

const sendServerError = (res, error, message) => {
    console.log(error)
    res.status(500).json({ success: false, message })
}

const sendInvalidId = (res, what) => {
    res.status(400).json({ success: false, message: `Invalid ${what}` })
}


// =============================================================
// DOCTORS
// =============================================================

// GET /api/admin/doctors?status=pending&search=sarah&page=1
const listDoctors = async (req, res) => {
    try {
        const { status, search } = req.query
        const { page, limit, skip } = getPagination(req.query)

        const filter = {}

        if (status === 'approved') {
            // doctors saved before approval existed have no status, so null matches them too
            filter.approvalStatus = { $in: ['approved', null] }
        } else if (['pending', 'rejected'].includes(status)) {
            filter.approvalStatus = status
        }

        if (search) {
            const regex = new RegExp(escapeRegex(search), 'i')
            filter.$or = [{ name: regex }, { speciality: regex }, { email: regex }]
        }

        const total = await doctorModel.countDocuments(filter)

        const doctors = await doctorModel
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('hospitalId', hospitalFields)

        const reliabilityMap = await getReliabilityMap(doctors.map(doctor => doctor._id))

        // How many doctors are waiting for approval (shown as a badge)
        const pendingCount = await doctorModel.countDocuments({ approvalStatus: 'pending' })

        res.json({
            success: true,
            doctors: doctors.map(doctor => toDoctorResponse(doctor, reliabilityMap, { isOwner: true })),
            total,
            page,
            pages: Math.ceil(total / limit),
            pendingCount
        })
    } catch (error) {
        sendServerError(res, error, 'Unable to load doctors')
    }
}


// PUT /api/admin/doctors/:id/approval   body: { status: 'approved' | 'rejected', note }
const setDoctorApproval = async (req, res) => {
    try {
        const { status, note } = req.body || {}

        if (!isValidId(req.params.id)) {
            return sendInvalidId(res, 'doctor')
        }

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be approved or rejected' })
        }

        const doctor = await doctorModel.findById(req.params.id)

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' })
        }

        doctor.approvalStatus = status
        doctor.approvalNote = status === 'rejected' && note ? String(note).trim().slice(0, 300) : ''
        await doctor.save()

        // The doctor's own clinic becomes visible to patients once the doctor is approved
        if (status === 'approved' && doctor.hospitalId) {
            await hospitalModel.findByIdAndUpdate(doctor.hospitalId, { verified: true })
        }

        if (status === 'approved') {
            await notifyDoctorByEmail(doctor, 'Registration approved', 'Your doctor account is approved. You can now login, set your working hours and receive appointments.')
        } else {
            const reason = doctor.approvalNote ? ` Reason: ${doctor.approvalNote}` : ''
            await notifyDoctorByEmail(doctor, 'Registration not approved', `Your registration could not be approved.${reason}`)
        }

        res.json({ success: true, message: `Doctor ${status}` })
    } catch (error) {
        sendServerError(res, error, 'Unable to update approval')
    }
}


// PUT /api/admin/doctors/:id
const updateDoctor = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return sendInvalidId(res, 'doctor')
        }

        const { name, speciality, degree, experience, about, fees, phone, available, hospitalId, password } = req.body || {}

        if (name !== undefined && !String(name).trim()) {
            return res.status(400).json({ success: false, message: 'Name cannot be empty' })
        }

        if (fees !== undefined && (isNaN(fees) || Number(fees) < 0)) {
            return res.status(400).json({ success: false, message: 'Fees must be a number that is 0 or more' })
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid phone number (10 to 15 digits)' })
        }

        if (password !== undefined && !isValidPassword(password)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' })
        }

        if (hospitalId) {
            const exists = isValidId(hospitalId) && await hospitalModel.exists({ _id: hospitalId })

            if (!exists) {
                return res.status(400).json({ success: false, message: 'Selected hospital does not exist' })
            }
        }

        const updates = {}

        if (name !== undefined) updates.name = String(name).trim()
        if (speciality !== undefined) updates.speciality = speciality
        if (degree !== undefined) updates.degree = degree
        if (experience !== undefined) updates.experience = experience
        if (about !== undefined) updates.about = about
        if (fees !== undefined) updates.fees = Number(fees)
        if (phone !== undefined) updates.phone = phone
        if (available !== undefined) updates.available = Boolean(available)
        if (hospitalId !== undefined) updates.hospitalId = hospitalId || null
        if (password !== undefined) updates.password = await bcrypt.hash(password, 10)

        const doctor = await doctorModel.findByIdAndUpdate(req.params.id, updates)

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' })
        }

        res.json({ success: true, message: 'Doctor updated successfully' })
    } catch (error) {
        sendServerError(res, error, 'Unable to update doctor')
    }
}


// DELETE /api/admin/doctors/:id
const deleteDoctor = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return sendInvalidId(res, 'doctor')
        }

        // Patients who are waiting for this doctor must not be left without an answer
        const activeCount = await appointmentModel.countDocuments({
            doctorId: req.params.id,
            status: { $in: ACTIVE_STATUSES }
        })

        if (activeCount > 0) {
            return res.status(409).json({
                success: false,
                message: `This doctor has ${activeCount} pending or confirmed appointment(s). Cancel them first, or mark the doctor as not available instead.`
            })
        }

        const doctor = await doctorModel.findByIdAndDelete(req.params.id)

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' })
        }

        res.json({ success: true, message: 'Doctor removed' })
    } catch (error) {
        sendServerError(res, error, 'Unable to remove doctor')
    }
}


// PUT /api/admin/doctors/:id/image  (multipart form, field name "image")
const updateDoctorImageByAdmin = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return sendInvalidId(res, 'doctor')
        }

        const doctor = await doctorModel.findByIdAndUpdate(req.params.id, { image: req.imagePath })

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' })
        }

        res.json({ success: true, message: 'Photo updated', image: req.imagePath })
    } catch (error) {
        sendServerError(res, error, 'Unable to save the photo')
    }
}


// =============================================================
// PATIENTS
// =============================================================

// GET /api/admin/patients?search=ravi&blocked=true&page=1
const listPatients = async (req, res) => {
    try {
        const { search, blocked } = req.query
        const { page, limit, skip } = getPagination(req.query)

        const filter = { role: { $ne: 'admin' } }

        if (blocked === 'true') filter.isBlocked = true

        if (search) {
            const regex = new RegExp(escapeRegex(search), 'i')
            filter.$or = [{ name: regex }, { email: regex }, { phone: regex }]
        }

        const total = await userModel.countDocuments(filter)

        const patients = await userModel
            .find(filter)
            .select('-password')
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit)

        // Number of appointments of each patient on this page
        const counts = await appointmentModel.aggregate([
            { $match: { userId: { $in: patients.map(patient => patient._id) } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ])

        const result = patients.map((patient) => {
            const found = counts.find(row => String(row._id) === String(patient._id))

            return { ...patient.toObject(), appointmentCount: found ? found.count : 0 }
        })

        res.json({ success: true, patients: result, total, page, pages: Math.ceil(total / limit) })
    } catch (error) {
        sendServerError(res, error, 'Unable to load patients')
    }
}


// PUT /api/admin/patients/:id/block   body: { blocked: true | false }
const setPatientBlocked = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return sendInvalidId(res, 'patient')
        }

        const { blocked } = req.body || {}

        if (typeof blocked !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Blocked must be true or false' })
        }

        // Admin accounts cannot be blocked from here
        const patient = await userModel.findOneAndUpdate(
            { _id: req.params.id, role: { $ne: 'admin' } },
            { isBlocked: blocked }
        )

        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found' })
        }

        res.json({ success: true, message: blocked ? 'Patient blocked' : 'Patient unblocked' })
    } catch (error) {
        sendServerError(res, error, 'Unable to update patient')
    }
}


// =============================================================
// APPOINTMENTS
// =============================================================

// GET /api/admin/appointments?status=Pending&date=2026-11-05&search=ravi&page=1
const listAppointments = async (req, res) => {
    try {
        const { status, date, search } = req.query
        const { page, limit, skip } = getPagination(req.query)

        const filter = {}

        if (status) filter.status = status
        if (date) filter.date = date

        // Search by patient name or doctor name
        if (search) {
            const regex = new RegExp(escapeRegex(search), 'i')

            const patients = await userModel.find({ name: regex }).select('_id')
            const doctors = await doctorModel.find({ name: regex }).select('_id')

            filter.$or = [
                { userId: { $in: patients.map(patient => patient._id) } },
                { doctorId: { $in: doctors.map(doctor => doctor._id) } }
            ]
        }

        const total = await appointmentModel.countDocuments(filter)

        const appointments = await appointmentModel
            .find(filter)
            .sort({ date: -1, time: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'name email phone')
            .populate('doctorId', 'name speciality')

        res.json({ success: true, appointments, total, page, pages: Math.ceil(total / limit) })
    } catch (error) {
        sendServerError(res, error, 'Unable to load appointments')
    }
}


// PUT /api/admin/appointments/:id/cancel   body: { note }
const cancelAppointmentByAdmin = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return sendInvalidId(res, 'appointment')
        }

        const appointment = await appointmentModel.findById(req.params.id)

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' })
        }

        if (!canChangeStatus('admin', appointment.status, 'Cancelled')) {
            return res.status(400).json({
                success: false,
                message: `A ${appointment.status.toLowerCase()} appointment cannot be cancelled`
            })
        }

        const note = req.body?.note ? String(req.body.note).trim().slice(0, 300) : ''

        await changeStatus(appointment, 'Cancelled', 'admin', note)

        const when = formatSlot(appointment.date, appointment.time)
        const reasonText = note ? ` Reason: ${note}` : ''

        await notifyPatient(appointment.userId, 'Appointment cancelled', `Your appointment on ${when} was cancelled by the admin.${reasonText}`, appointment._id)
        await notifyDoctor(appointment.doctorId, 'Appointment cancelled', `The appointment on ${when} was cancelled by the admin.${reasonText}`, appointment._id)

        res.json({ success: true, message: 'Appointment cancelled' })
    } catch (error) {
        sendServerError(res, error, 'Unable to cancel appointment')
    }
}


// PUT /api/admin/appointments/:id/refund
// The admin sends the money back (in Razorpay or by bank) and then marks it here
const markRefunded = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return sendInvalidId(res, 'appointment')
        }

        const appointment = await appointmentModel.findById(req.params.id)

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' })
        }

        if (appointment.paymentStatus !== 'Refund pending') {
            return res.status(400).json({ success: false, message: 'This appointment has no refund pending' })
        }

        appointment.paymentStatus = 'Refunded'
        await appointment.save()

        await notifyPatient(appointment.userId, 'Refund completed', `Your refund of ₹${appointment.amount} was processed.`, appointment._id)

        res.json({ success: true, message: 'Marked as refunded' })
    } catch (error) {
        sendServerError(res, error, 'Unable to update the refund')
    }
}


// =============================================================
// HOSPITALS AND CLINICS
// =============================================================

const readHospitalFields = (body) => {
    const { name, type, line1, city, state, phone, about } = body || {}

    return { name, type, line1, city, state, phone, about }
}

// GET /api/admin/hospitals  (all, including clinics not verified yet)
const listHospitals = async (req, res) => {
    try {
        const hospitals = await hospitalModel.find().sort({ name: 1 })

        const doctorCounts = await doctorModel.aggregate([
            { $match: { hospitalId: { $ne: null } } },
            { $group: { _id: '$hospitalId', count: { $sum: 1 } } }
        ])

        const result = hospitals.map((hospital) => {
            const found = doctorCounts.find(row => String(row._id) === String(hospital._id))

            return { ...hospital.toObject(), doctorCount: found ? found.count : 0 }
        })

        res.json({ success: true, hospitals: result })
    } catch (error) {
        sendServerError(res, error, 'Unable to load hospitals')
    }
}

// POST /api/admin/hospitals
const createHospital = async (req, res) => {
    try {
        const fields = readHospitalFields(req.body)

        if (!fields.name || !String(fields.name).trim()) {
            return res.status(400).json({ success: false, message: 'Hospital name is required' })
        }

        if (fields.type && !HOSPITAL_TYPES.includes(fields.type)) {
            return res.status(400).json({ success: false, message: `Type must be one of: ${HOSPITAL_TYPES.join(', ')}` })
        }

        if (fields.phone && !isValidPhone(fields.phone)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid phone number (10 to 15 digits)' })
        }

        const hospital = await hospitalModel.create({ ...fields, name: String(fields.name).trim(), verified: true })

        res.status(201).json({ success: true, message: 'Hospital added', hospital })
    } catch (error) {
        sendServerError(res, error, 'Unable to add hospital')
    }
}

// PUT /api/admin/hospitals/:id
const updateHospital = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return sendInvalidId(res, 'hospital')
        }

        const fields = readHospitalFields(req.body)

        if (fields.name !== undefined && !String(fields.name).trim()) {
            return res.status(400).json({ success: false, message: 'Hospital name cannot be empty' })
        }

        if (fields.type && !HOSPITAL_TYPES.includes(fields.type)) {
            return res.status(400).json({ success: false, message: `Type must be one of: ${HOSPITAL_TYPES.join(', ')}` })
        }

        if (fields.phone && !isValidPhone(fields.phone)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid phone number (10 to 15 digits)' })
        }

        // Only change the fields that were sent
        const updates = {}

        Object.keys(fields).forEach((key) => {
            if (fields[key] !== undefined) updates[key] = fields[key]
        })

        if (req.body.verified !== undefined) updates.verified = Boolean(req.body.verified)

        const hospital = await hospitalModel.findByIdAndUpdate(req.params.id, updates)

        if (!hospital) {
            return res.status(404).json({ success: false, message: 'Hospital not found' })
        }

        res.json({ success: true, message: 'Hospital updated' })
    } catch (error) {
        sendServerError(res, error, 'Unable to update hospital')
    }
}

// DELETE /api/admin/hospitals/:id
const deleteHospital = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return sendInvalidId(res, 'hospital')
        }

        const doctorCount = await doctorModel.countDocuments({ hospitalId: req.params.id })

        if (doctorCount > 0) {
            return res.status(409).json({
                success: false,
                message: `${doctorCount} doctor(s) work here. Move or remove them first.`
            })
        }

        const hospital = await hospitalModel.findByIdAndDelete(req.params.id)

        if (!hospital) {
            return res.status(404).json({ success: false, message: 'Hospital not found' })
        }

        res.json({ success: true, message: 'Hospital removed' })
    } catch (error) {
        sendServerError(res, error, 'Unable to remove hospital')
    }
}


// =============================================================
// CONTACT MESSAGES
// =============================================================

// GET /api/admin/messages?page=1
const listMessages = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query)

        const total = await contactModel.countDocuments()

        const messages = await contactModel
            .find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        res.json({ success: true, messages, total, page, pages: Math.ceil(total / limit) })
    } catch (error) {
        sendServerError(res, error, 'Unable to load messages')
    }
}


export {
    listDoctors,
    setDoctorApproval,
    updateDoctor,
    deleteDoctor,
    updateDoctorImageByAdmin,
    listPatients,
    setPatientBlocked,
    listAppointments,
    cancelAppointmentByAdmin,
    markRefunded,
    listHospitals,
    createHospital,
    updateHospital,
    deleteHospital,
    listMessages
}
