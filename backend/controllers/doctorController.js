import doctorModel from '../models/doctorModel.js'
import hospitalModel from '../models/hospitalModel.js'
import bcrypt from 'bcryptjs'
import generateToken from '../utils/generateToken.js'
import {
    cleanEmail,
    isValidEmail,
    isValidPassword,
    isValidPhone,
    isValidId
} from '../utils/validators.js'
import { isValidDate, isValidTime, timeToMinutes } from '../utils/clinicTime.js'
import { checkBookingDate, generateSlots } from '../utils/slots.js'
import { getBookedTimes } from '../utils/appointmentActions.js'
import { notifyAdmins } from '../utils/notify.js'
import {
    approvedDoctorFilter,
    hospitalFields,
    getReliabilityMap,
    toDoctorResponse
} from '../utils/doctorHelpers.js'
import {
    ALLOWED_SLOT_DURATIONS,
    HOSPITAL_TYPES
} from '../utils/constants.js'


// ---------------------------------------------------------------
// PUBLIC: anyone can see approved doctors
// ---------------------------------------------------------------

const getDoctors = async (req, res) => {
    try {
        const doctors = await doctorModel
            .find({ available: true, ...approvedDoctorFilter })
            .populate('hospitalId', hospitalFields)

        const reliabilityMap = await getReliabilityMap(doctors.map(doctor => doctor._id))

        return res.status(200).json({
            success: true,
            doctors: doctors.map(doctor => toDoctorResponse(doctor, reliabilityMap))
        })
    } catch (error) {
        console.error('Get doctors error:', error.message)

        return res.status(500).json({
            success: false,
            message: 'Unable to fetch doctors'
        })
    }
}


const getDoctorById = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid doctor' })
        }

        const doctor = await doctorModel
            .findOne({ _id: req.params.id, ...approvedDoctorFilter })
            .populate('hospitalId', hospitalFields)

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' })
        }

        const reliabilityMap = await getReliabilityMap([doctor._id])

        return res.json({
            success: true,
            doctor: toDoctorResponse(doctor, reliabilityMap)
        })
    } catch (error) {
        console.error('Get doctor error:', error.message)

        return res.status(500).json({ success: false, message: 'Unable to load doctor' })
    }
}


// GET /api/doctor/:id/slots?date=2026-11-05
// The slots are calculated from the database every time, so a slot that was
// just booked by someone else disappears at once.
const getDoctorSlots = async (req, res) => {
    try {
        const { id } = req.params
        const { date } = req.query

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid doctor' })
        }

        if (!isValidDate(date)) {
            return res.status(400).json({ success: false, message: 'Please choose a valid date (YYYY-MM-DD)' })
        }

        const dateError = checkBookingDate(date)

        if (dateError) {
            return res.status(400).json({ success: false, message: dateError })
        }

        const doctor = await doctorModel.findOne({ _id: id, ...approvedDoctorFilter })

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' })
        }

        if (!doctor.available) {
            return res.json({ success: true, date, slotDuration: doctor.slotDuration, accepting: false, slots: [] })
        }

        const bookedTimes = await getBookedTimes(doctor._id, date)

        return res.json({
            success: true,
            date,
            slotDuration: doctor.slotDuration,
            onLeave: doctor.unavailableDates.includes(date),
            accepting: true,
            slots: generateSlots(doctor, date, bookedTimes)
        })
    } catch (error) {
        console.error('Get slots error:', error.message)

        return res.status(500).json({ success: false, message: 'Unable to load time slots' })
    }
}


// ---------------------------------------------------------------
// ADMIN: add a doctor directly (already approved)
// ---------------------------------------------------------------

const addDoctor = async (req, res) => {
    try {
        const {
            name,
            password,
            image,
            speciality,
            degree,
            experience,
            about,
            fees,
            phone,
            address,
            hospitalId
        } = req.body || {}

        const email = cleanEmail(req.body?.email)

        if (!name || !email || !password || !speciality) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, password and speciality are required'
            })
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' })
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' })
        }

        if (fees !== undefined && (isNaN(fees) || Number(fees) < 0)) {
            return res.status(400).json({ success: false, message: 'Fees must be a number that is 0 or more' })
        }

        if (hospitalId && (!isValidId(hospitalId) || !(await hospitalModel.exists({ _id: hospitalId })))) {
            return res.status(400).json({ success: false, message: 'Selected hospital does not exist' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const doctor = await doctorModel.create({
            name: name.trim(),
            email,
            password: hashedPassword,
            image,
            speciality,
            degree,
            experience,
            about,
            fees,
            phone,
            address,
            hospitalId: hospitalId || null,
            approvalStatus: 'approved'
        })

        const safeDoctor = doctor.toObject()
        delete safeDoctor.password

        return res.status(201).json({
            success: true,
            message: 'Doctor added successfully',
            doctor: safeDoctor
        })
    } catch (error) {
        console.error('Add doctor error:', error.message)

        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'A doctor with this email already exists' })
        }

        return res.status(500).json({ success: false, message: 'Unable to add doctor' })
    }
}


// ---------------------------------------------------------------
// DOCTOR SELF-REGISTRATION (the admin must approve it)
// ---------------------------------------------------------------

// Body: name, email, password, speciality, degree, experience, fees, about, phone
// plus EITHER hospitalId (an existing hospital)
// OR clinic: { name, type, line1, city, state, phone } (a new clinic)
const registerDoctor = async (req, res) => {

    let newHospital = null

    try {
        const {
            name,
            password,
            speciality,
            degree,
            experience,
            about,
            fees,
            phone,
            hospitalId,
            clinic
        } = req.body || {}

        const email = cleanEmail(req.body?.email)

        if (!name || !email || !password || !speciality) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, password and speciality are required'
            })
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' })
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' })
        }

        if (fees === undefined || isNaN(fees) || Number(fees) < 0) {
            return res.status(400).json({ success: false, message: 'Please enter the consultation fee' })
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid phone number (10 to 15 digits)' })
        }

        // The doctor must say where they practice
        if (!hospitalId && !clinic?.name) {
            return res.status(400).json({
                success: false,
                message: 'Please choose your hospital or enter your clinic details'
            })
        }

        if (await doctorModel.exists({ email })) {
            return res.status(409).json({ success: false, message: 'A doctor with this email already exists' })
        }

        let hospitalToUse = null

        if (hospitalId) {
            hospitalToUse = isValidId(hospitalId)
                ? await hospitalModel.findOne({ _id: hospitalId, verified: true })
                : null

            if (!hospitalToUse) {
                return res.status(400).json({ success: false, message: 'Selected hospital does not exist' })
            }
        } else {
            // A new clinic. It stays unverified until the admin approves this doctor.
            newHospital = await hospitalModel.create({
                name: clinic.name.trim(),
                type: HOSPITAL_TYPES.includes(clinic.type) ? clinic.type : 'Independent Clinic',
                line1: clinic.line1 || '',
                city: clinic.city || '',
                state: clinic.state || '',
                phone: clinic.phone || '',
                verified: false
            })

            hospitalToUse = newHospital
        }

        const doctor = await doctorModel.create({
            name: name.trim(),
            email,
            password: await bcrypt.hash(password, 10),
            speciality,
            degree,
            experience,
            about,
            fees: Number(fees),
            phone,
            hospitalId: hospitalToUse._id,
            approvalStatus: 'pending'
        })

        await notifyAdmins(
            'New doctor registration',
            `${doctor.name} (${doctor.speciality}) registered and is waiting for approval.`
        )

        return res.status(201).json({
            success: true,
            message: 'Registration submitted. You can login after the admin approves your account.',
            doctorId: doctor._id
        })

    } catch (error) {
        console.error('Doctor register error:', error.message)

        // Do not leave an unused clinic behind if the doctor could not be saved
        if (newHospital) {
            await hospitalModel.findByIdAndDelete(newHospital._id)
        }

        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'A doctor with this email already exists' })
        }

        return res.status(500).json({ success: false, message: 'Unable to register. Please try again' })
    }
}


// ---------------------------------------------------------------
// DOCTOR: login, own profile, availability
// ---------------------------------------------------------------

const doctorLogin = async (req, res) => {
    try {
        const { password } = req.body || {}
        const email = cleanEmail(req.body?.email)

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please enter email and password' })
        }

        const doctor = await doctorModel.findOne({ email })

        if (!doctor || !(await bcrypt.compare(password, doctor.password))) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' })
        }

        const token = generateToken(doctor._id, 'doctor')

        return res.json({
            success: true,
            message: 'Login successful',
            token,
            approvalStatus: doctor.approvalStatus
        })
    } catch (error) {
        console.error('Doctor login error:', error.message)

        return res.status(500).json({ success: false, message: 'Unable to login. Please try again' })
    }
}


const getDoctorProfile = async (req, res) => {
    try {
        const doctor = await doctorModel
            .findById(req.doctorId)
            .populate('hospitalId', hospitalFields)

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' })
        }

        const reliabilityMap = await getReliabilityMap([doctor._id])

        return res.json({
            success: true,
            doctor: toDoctorResponse(doctor, reliabilityMap, { isOwner: true })
        })
    } catch (error) {
        console.error('Doctor profile error:', error.message)

        return res.status(500).json({ success: false, message: 'Unable to load profile' })
    }
}


// The doctor changes their own details
const updateDoctorProfile = async (req, res) => {
    try {
        const { name, speciality, degree, experience, about, fees, phone, available, hospitalId } = req.body || {}

        if (name !== undefined && !String(name).trim()) {
            return res.status(400).json({ success: false, message: 'Name cannot be empty' })
        }

        if (fees !== undefined && (isNaN(fees) || Number(fees) < 0)) {
            return res.status(400).json({ success: false, message: 'Fees must be a number that is 0 or more' })
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid phone number (10 to 15 digits)' })
        }

        if (available !== undefined && typeof available !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Available must be true or false' })
        }

        if (hospitalId) {
            const exists = isValidId(hospitalId) && await hospitalModel.exists({ _id: hospitalId, verified: true })

            if (!exists) {
                return res.status(400).json({ success: false, message: 'Selected hospital does not exist' })
            }
        }

        // Only these fields can be changed here. Approval status cannot.
        const updates = {}

        if (name !== undefined) updates.name = String(name).trim()
        if (speciality !== undefined) updates.speciality = speciality
        if (degree !== undefined) updates.degree = degree
        if (experience !== undefined) updates.experience = experience
        if (about !== undefined) updates.about = about
        if (fees !== undefined) updates.fees = Number(fees)
        if (phone !== undefined) updates.phone = phone
        if (available !== undefined) updates.available = available
        if (hospitalId !== undefined) updates.hospitalId = hospitalId || null

        await doctorModel.findByIdAndUpdate(req.doctorId, updates)

        return res.json({ success: true, message: 'Profile updated successfully' })
    } catch (error) {
        console.error('Update doctor profile error:', error.message)

        return res.status(500).json({ success: false, message: 'Unable to update profile' })
    }
}


// Body: { availability: [{ day, startTime, endTime }], slotDuration, unavailableDates: ["2026-11-10"] }
const updateAvailability = async (req, res) => {
    try {
        const { availability, slotDuration, unavailableDates } = req.body || {}
        const updates = {}

        if (availability !== undefined) {

            if (!Array.isArray(availability) || availability.length > 30) {
                return res.status(400).json({ success: false, message: 'Working hours must be a list' })
            }

            for (const period of availability) {

                const dayIsValid = Number.isInteger(period.day) && period.day >= 0 && period.day <= 6

                if (!dayIsValid || !isValidTime(period.startTime) || !isValidTime(period.endTime)) {
                    return res.status(400).json({ success: false, message: 'Each working period needs a day (0-6), a start time and an end time (HH:MM)' })
                }

                if (timeToMinutes(period.startTime) >= timeToMinutes(period.endTime)) {
                    return res.status(400).json({ success: false, message: 'End time must be after start time' })
                }
            }

            // Two periods on the same day must not overlap
            const sorted = [...availability].sort((a, b) =>
                a.day - b.day || timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
            )

            for (let i = 1; i < sorted.length; i++) {
                const sameDay = sorted[i].day === sorted[i - 1].day
                const overlaps = timeToMinutes(sorted[i].startTime) < timeToMinutes(sorted[i - 1].endTime)

                if (sameDay && overlaps) {
                    return res.status(400).json({ success: false, message: 'Working periods on the same day cannot overlap' })
                }
            }

            updates.availability = sorted.map(({ day, startTime, endTime }) => ({ day, startTime, endTime }))
        }

        if (slotDuration !== undefined) {
            if (!ALLOWED_SLOT_DURATIONS.includes(Number(slotDuration))) {
                return res.status(400).json({
                    success: false,
                    message: `Time per patient must be one of: ${ALLOWED_SLOT_DURATIONS.join(', ')} minutes`
                })
            }

            updates.slotDuration = Number(slotDuration)
        }

        if (unavailableDates !== undefined) {
            if (!Array.isArray(unavailableDates) || unavailableDates.length > 90 || !unavailableDates.every(isValidDate)) {
                return res.status(400).json({ success: false, message: 'Leave days must be a list of dates (YYYY-MM-DD)' })
            }

            updates.unavailableDates = [...new Set(unavailableDates)].sort()
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'Nothing to update' })
        }

        await doctorModel.findByIdAndUpdate(req.doctorId, updates)

        return res.json({ success: true, message: 'Availability updated successfully' })
    } catch (error) {
        console.error('Update availability error:', error.message)

        return res.status(500).json({ success: false, message: 'Unable to update availability' })
    }
}


const updateDoctorImage = async (req, res) => {
    try {
        await doctorModel.findByIdAndUpdate(req.doctorId, { image: req.imagePath })

        return res.json({ success: true, message: 'Photo updated', image: req.imagePath })
    } catch (error) {
        console.error('Doctor image error:', error.message)

        return res.status(500).json({ success: false, message: 'Unable to save the photo' })
    }
}


export {
    getDoctors,
    getDoctorById,
    getDoctorSlots,
    addDoctor,
    registerDoctor,
    doctorLogin,
    getDoctorProfile,
    updateDoctorProfile,
    updateAvailability,
    updateDoctorImage
}
