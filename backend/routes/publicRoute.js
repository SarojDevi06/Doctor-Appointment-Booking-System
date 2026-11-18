import express from 'express'
import { getPublicStats } from '../controllers/publicController.js'

const publicRouter = express.Router()

publicRouter.get('/stats', getPublicStats)

export default publicRouter
