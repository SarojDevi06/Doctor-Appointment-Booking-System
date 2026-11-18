import express from 'express'
import { adminLogin, getAdminProfile } from '../controllers/adminController.js'
import authAdmin from '../middleware/authAdmin.js'
import { loginLimiter } from '../middleware/rateLimiter.js'

const adminRouter = express.Router()

adminRouter.post('/login', loginLimiter, adminLogin)

adminRouter.get('/profile', authAdmin, getAdminProfile)

export default adminRouter
