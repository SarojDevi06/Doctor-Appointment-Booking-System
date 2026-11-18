import mongoose from 'mongoose'

// One working period in the week, for example Monday 09:00 - 13:00
const workingHoursSchema = new mongoose.Schema(
    {
        day: {
            type: Number,    // 0 = Sunday ... 6 = Saturday
            min: 0,
            max: 6,
            required: true
        },
        startTime: {
            type: String,    // "09:00"
            required: true
        },
        endTime: {
            type: String,    // "13:00"
            required: true
        }
    },
    { _id: false }
)

const doctorSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: true
        },
        image: {
            type: String,
            default: ''
        },
        speciality: {
            type: String,
            required: true
        },
        degree: {
            type: String,
            default: ''
        },
        experience: {
            type: String,
            default: ''
        },
        about: {
            type: String,
            default: ''
        },
        fees: {
            type: Number,
            default: 0
        },
        phone: {
            type: String,
            default: ''
        },

        // Old address field. Still used for doctors who have no hospital.
        address: {
            line1: {
                type: String,
                default: ''
            },
            line2: {
                type: String,
                default: ''
            }
        },

        // The hospital or clinic where the doctor practices
        hospitalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'hospital',
            default: null
        },

        // Doctors who register themselves start as 'pending' and the admin approves them.
        // Doctors that already existed before this field count as approved.
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'approved'
        },
        approvalNote: {
            type: String,
            default: ''
        },

        // The doctor can switch this off to stop receiving new appointments
        available: {
            type: Boolean,
            default: true
        },

        // Weekly working hours, minutes per patient and days of leave.
        // If availability is empty the default (Mon-Sat 10:00-17:00) is used.
        availability: {
            type: [workingHoursSchema],
            default: undefined
        },
        slotDuration: {
            type: Number,
            default: 30
        },
        unavailableDates: {
            type: [String],     // ["2026-11-10", "2026-11-11"]
            default: []
        }
    },
    {
        timestamps: true
    }
)

const doctorModel =
    mongoose.models.doctor ||
    mongoose.model('doctor', doctorSchema)

export default doctorModel
