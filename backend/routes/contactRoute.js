import express from 'express'
import { submitContact } from '../controllers/contactController.js'
import { contactLimiter } from '../middleware/rateLimiter.js'

const contactRouter = express.Router()

contactRouter.post('/submit', contactLimiter, submitContact)

export default contactRouter
