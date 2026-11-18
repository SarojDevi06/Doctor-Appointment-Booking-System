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

        // date looks like "2026-11-05", time looks like "14:30"
        date: {
            type: String,
            required: true
        },
        time: {
            type: String,
            required: true
        },

        // Why the patient is visiting (optional)
        reason: {
            type: String,
            default: ''
        },

        amount: {
            type: Number,
            default: 0
        },

        // Pending -> Confirmed -> Completed
        // or Rejected / Cancelled / No-Show
        // (appointments saved before this update stay 'Confirmed')
        status: {
            type: String,
            enum: ['Pending', 'Confirmed', 'Rejected', 'Completed', 'Cancelled', 'No-Show'],
            default: 'Pending'
        },
        cancelled: {
            type: Boolean,
            default: false
        },
        cancelledBy: {
            type: String,
            enum: ['patient', 'doctor', 'admin', ''],
            default: ''
        },
        statusNote: {
            type: String,      // reason given by the doctor or admin
            default: ''
        },
        rescheduleCount: {
            type: Number,
            default: 0
        },

        // Only exists while the time slot is taken. A unique index on it
        // makes double booking impossible (see below).
        slotKey: {
            type: String
        },

        // Used on the day of the visit for the clinic queue
        queueStatus: {
            type: String,
            enum: ['Not arrived', 'Waiting', 'In consultation', 'Done'],
            default: 'Not arrived'
        },

        // Online payment (filled by the payment feature)
        paymentStatus: {
            type: String,
            enum: ['Unpaid', 'Paid', 'Failed', 'Refund pending', 'Refunded'],
            default: 'Unpaid'
        },
        paymentOrderId: {
            type: String,
            default: ''
        },
        paymentId: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true
    }
)

// Two appointments can never have the same slotKey.
// "sparse" means appointments without a slotKey (cancelled ones) are ignored.
appointmentSchema.index({ slotKey: 1 }, { unique: true, sparse: true })

appointmentSchema.index({ doctorId: 1, date: 1 })
appointmentSchema.index({ userId: 1, createdAt: -1 })

const appointmentModel =
    mongoose.models.appointment ||
    mongoose.model('appointment', appointmentSchema)

export default appointmentModel
