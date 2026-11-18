import express from 'express'
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController.js'
import { authAnyRole } from '../middleware/auth.js'

const notificationRouter = express.Router()

notificationRouter.get('/list', authAnyRole, getNotifications)
notificationRouter.put('/read-all', authAnyRole, markAllAsRead)
notificationRouter.put('/read/:id', authAnyRole, markAsRead)

export default notificationRouter
