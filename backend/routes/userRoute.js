import express from 'express'
import {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    updateProfileImage
} from '../controllers/userController.js'

import authUser from '../middleware/authUser.js'
import { uploadImage } from '../middleware/upload.js'
import { loginLimiter } from '../middleware/rateLimiter.js'

const userRouter = express.Router()

userRouter.post('/register', loginLimiter, registerUser)

userRouter.post('/login', loginLimiter, loginUser)

userRouter.get('/profile', authUser, getProfile)

userRouter.put('/update-profile', authUser, updateProfile)

userRouter.put('/image', authUser, uploadImage, updateProfileImage)

export default userRouter
