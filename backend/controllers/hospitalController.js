import doctorModel from '../models/doctorModel.js'
import hospitalModel from '../models/hospitalModel.js'
import { isValidId } from '../utils/validators.js'
import { approvedDoctorFilter, getReliabilityMap, toDoctorResponse, hospitalFields } from '../utils/doctorHelpers.js'

// PUBLIC: GET /api/hospital/list
// Verified hospitals and clinics, with the number of doctors in each
const getHospitals = async (req, res) => {
    try {
        const hospitals = await hospitalModel.find({ verified: true }).sort({ name: 1 })

        const doctorCounts = await doctorModel.aggregate([
            { $match: { ...approvedDoctorFilter, hospitalId: { $ne: null } } },
            { $group: { _id: '$hospitalId', count: { $sum: 1 } } }
        ])

        const result = hospitals.map((hospital) => {
            const found = doctorCounts.find(row => String(row._id) === String(hospital._id))

            return { ...hospital.toObject(), doctorCount: found ? found.count : 0 }
        })

        res.json({ success: true, hospitals: result })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to load hospitals' })
    }
}

// PUBLIC: GET /api/hospital/:id  (the hospital and its doctors)
const getHospitalById = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid hospital' })
        }

        const hospital = await hospitalModel.findOne({ _id: req.params.id, verified: true })

        if (!hospital) {
            return res.status(404).json({ success: false, message: 'Hospital not found' })
        }

        const doctors = await doctorModel
            .find({ hospitalId: hospital._id, available: true, ...approvedDoctorFilter })
            .populate('hospitalId', hospitalFields)

        const reliabilityMap = await getReliabilityMap(doctors.map(doctor => doctor._id))

        res.json({
            success: true,
            hospital,
            doctors: doctors.map(doctor => toDoctorResponse(doctor, reliabilityMap))
        })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to load hospital' })
    }
}

export { getHospitals, getHospitalById }
