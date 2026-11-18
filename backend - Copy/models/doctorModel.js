import mongoose from 'mongoose'

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

        available: {
            type: Boolean,
            default: true
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