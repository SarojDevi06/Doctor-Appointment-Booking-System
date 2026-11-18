import notificationModel from '../models/notificationModel.js'
import { isValidId } from '../utils/validators.js'

// These routes work for patients, doctors and admins (authAnyRole sets req.auth)

// GET /api/notification/list
const getNotifications = async (req, res) => {
    try {
        const notifications = await notificationModel
            .find({ recipientId: req.auth.id, recipientRole: req.auth.role })
            .sort({ createdAt: -1 })
            .limit(30)

        const unreadCount = await notificationModel.countDocuments({
            recipientId: req.auth.id,
            recipientRole: req.auth.role,
            isRead: false
        })

        res.json({ success: true, notifications, unreadCount })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to load notifications' })
    }
}

// PUT /api/notification/read/:id
const markAsRead = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid notification' })
        }

        // A person can only change their own notifications
        await notificationModel.updateOne(
            { _id: req.params.id, recipientId: req.auth.id, recipientRole: req.auth.role },
            { isRead: true }
        )

        res.json({ success: true })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to update notification' })
    }
}

// PUT /api/notification/read-all
const markAllAsRead = async (req, res) => {
    try {
        await notificationModel.updateMany(
            { recipientId: req.auth.id, recipientRole: req.auth.role, isRead: false },
            { isRead: true }
        )

        res.json({ success: true })
    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'Unable to update notifications' })
    }
}

export { getNotifications, markAsRead, markAllAsRead }
