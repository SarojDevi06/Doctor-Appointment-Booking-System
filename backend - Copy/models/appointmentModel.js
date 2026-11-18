import mongoose from 'mongoose'

const appointmentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user',
            required: true
        },

        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'doctor',
            required: true
        },

        date: {
            type: String,
            required: true
        },

        time: {
            type: String,
            required: true
        },

        amount: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            default: 'Confirmed'
        },

        cancelled: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
)

const appointmentModel =
    mongoose.models.appointment ||
    mongoose.model('appointment', appointmentSchema)

export default appointmentModel