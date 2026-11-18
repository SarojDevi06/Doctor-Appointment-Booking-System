import express from 'express'
import rateLimit from 'express-rate-limit'
import { chat } from '../controllers/assistantController.js'

const assistantRouter = express.Router()

// Keeps the assistant (and the optional AI cost) from being abused
const assistantLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many questions. Please wait a few minutes' }
})

assistantRouter.post('/chat', assistantLimiter, chat)

export default assistantRouter
