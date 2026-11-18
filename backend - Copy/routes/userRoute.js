import express from 'express'
import {
    registerUser,
    loginUser,
    getProfile,
    updateProfile
} from '../controllers/userController.js'

import authUser from '../middleware/authUser.js'
import { loginLimiter } from '../middleware/rateLimiter.js'

const userRouter = express.Router()

userRouter.post('/register', loginLimiter, registerUser)

userRouter.post('/login', loginLimiter, loginUser)

userRouter.get('/profile', authUser, getProfile)

userRouter.put('/update-profile', authUser, updateProfile)

export default userRouter
