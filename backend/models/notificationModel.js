import mongoose from 'mongoose'

// A message shown inside the website (the bell icon).
// The same message is also emailed to patients when possible.
const notificationSchema = new mongoose.Schema(
    {
        // Who should see it
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        recipientRole: {
            type: String,
            enum: ['patient', 'doctor', 'admin'],
            required: true
        },
        title: {
            type: String,
            required: true
        },
        message: {
            type: String,
            required: true
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'appointment'
        },
        isRead: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
)

notificationSchema.index({ recipientId: 1, createdAt: -1 })

const notificationModel =
    mongoose.models.notification ||
    mongoose.model('notification', notificationSchema)

export default notificationModel
