import mongoose from 'mongoose'

// A hospital, a clinic, or the private clinic of one independent doctor.
// Doctors point to their hospital with doctor.hospitalId.
const hospitalSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            enum: ['Hospital', 'Clinic', 'Independent Clinic'],
            default: 'Clinic'
        },
        line1: {
            type: String,
            default: ''
        },
        city: {
            type: String,
            default: ''
        },
        state: {
            type: String,
            default: ''
        },
        phone: {
            type: String,
            default: ''
        },
        about: {
            type: String,
            default: ''
        },
        // Hospitals created by a doctor during registration stay unverified
        // until the admin approves that doctor
        verified: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
)

const hospitalModel =
    mongoose.models.hospital ||
    mongoose.model('hospital', hospitalSchema)

export default hospitalModel
