import notificationModel from '../models/notificationModel.js'
import userModel from '../models/userModel.js'
import doctorModel from '../models/doctorModel.js'
import sendEmail from './sendEmail.js'
import { isValidDate, isValidTime } from './clinicTime.js'

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ("2026-11-05", "14:30") -> "05 Nov 2026 at 2:30 PM"
export const formatSlot = (date, time) => {

    // Old appointments may have a different date format. Show them as they are.
    if (!isValidDate(date) || !isValidTime(time)) {
        return `${date} ${time}`
    }

    const [year, month, day] = date.split('-')
    const [hours, minutes] = time.split(':').map(Number)

    const hour12 = hours % 12 || 12
    const period = hours >= 12 ? 'PM' : 'AM'

    return `${day} ${monthNames[Number(month) - 1]} ${year} at ${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

// Saves a notification. It never throws, because a notification problem
// must not stop a booking or a status change.
const saveNotification = async (recipientId, recipientRole, title, message, appointmentId) => {
    try {
        await notificationModel.create({
            recipientId,
            recipientRole,
            title,
            message,
            appointmentId
        })
    } catch (error) {
        console.log('Notification failed:', error.message)
    }
}

// In-app notification + email for a patient
export const notifyPatient = async (userId, title, message, appointmentId) => {
    await saveNotification(userId, 'patient', title, message, appointmentId)

    try {
        const user = await userModel.findById(userId).select('email')

        // Not awaited: the user should not wait for the email to be sent
        if (user) {
            sendEmail(user.email, title, message)
        }
    } catch (error) {
        console.log('Patient email lookup failed:', error.message)
    }
}

// In-app notification for a doctor
export const notifyDoctor = async (doctorId, title, message, appointmentId) => {
    await saveNotification(doctorId, 'doctor', title, message, appointmentId)
}

// In-app notification + email for a doctor (used for approval results)
export const notifyDoctorByEmail = async (doctor, title, message) => {
    await saveNotification(doctor._id, 'doctor', title, message)
    sendEmail(doctor.email, title, message)
}

// In-app notification for every admin
export const notifyAdmins = async (title, message) => {
    try {
        const admins = await userModel.find({ role: 'admin' }).select('_id')

        for (const admin of admins) {
            await saveNotification(admin._id, 'admin', title, message)
        }
    } catch (error) {
        console.log('Admin notification failed:', error.message)
    }
}

// Used by the notification list to show a doctor's or patient's name
export const getDoctorName = async (doctorId) => {
    const doctor = await doctorModel.findById(doctorId).select('name')
    return doctor ? doctor.name : 'the doctor'
}
