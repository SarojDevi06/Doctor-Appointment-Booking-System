import mongoose from 'mongoose'
import appointmentModel from '../models/appointmentModel.js'
import { calculateReliability } from './reliability.js'
import { defaultAvailability } from './slots.js'

// Doctors that patients are allowed to see.
// Doctors saved before approval existed have no approvalStatus, so they match too.
export const approvedDoctorFilter = {
    approvalStatus: { $nin: ['pending', 'rejected'] }
}

// What a hospital looks like when it is attached to a doctor
export const hospitalFields = 'name type line1 city state phone verified'

// Counts completed appointments and appointments cancelled by the doctor,
// then turns the counts into reliability numbers. One database query for all doctors.
export const getReliabilityMap = async (doctorIds) => {

    const objectIds = doctorIds.map(id => new mongoose.Types.ObjectId(String(id)))

    const counts = await appointmentModel.aggregate([
        {
            $match: {
                doctorId: { $in: objectIds },
                $or: [
                    { status: 'Completed' },
                    { status: 'Cancelled', cancelledBy: 'doctor' }
                ]
            }
        },
        {
            $group: {
                _id: { doctorId: '$doctorId', status: '$status' },
                count: { $sum: 1 }
            }
        }
    ])

    const map = new Map()

    doctorIds.forEach(id => map.set(String(id), { completed: 0, cancelled: 0 }))

    counts.forEach((row) => {
        const entry = map.get(String(row._id.doctorId))

        if (row._id.status === 'Completed') {
            entry.completed = row.count
        } else {
            entry.cancelled = row.count
        }
    })

    const result = new Map()

    map.forEach((value, key) => {
        result.set(key, calculateReliability(value.completed, value.cancelled))
    })

    return result
}

// Turns a doctor document into the safe object we send to the frontend.
//   - removes the password
//   - puts the populated hospital in "hospital"
//   - adds the reliability numbers
//   - fills in the default working hours if the doctor has not set any
export const toDoctorResponse = (doctor, reliabilityMap, { isOwner = false } = {}) => {

    const result = doctor.toObject()

    delete result.password

    // Private details are only for the doctor themselves and the admin
    if (!isOwner) {
        delete result.email
        delete result.approvalNote
        delete result.unavailableDates
    }

    const hospital = result.hospitalId && result.hospitalId._id ? result.hospitalId : null

    result.hospital = hospital
    result.hospitalId = hospital ? hospital._id : (result.hospitalId || null)

    if (!result.availability) {
        result.availability = defaultAvailability
    }

    result.reliability = reliabilityMap
        ? reliabilityMap.get(String(doctor._id))
        : undefined

    return result
}
