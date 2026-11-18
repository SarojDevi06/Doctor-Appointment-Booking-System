import express from 'express'
import { getHospitals, getHospitalById } from '../controllers/hospitalController.js'

const hospitalRouter = express.Router()

hospitalRouter.get('/list', getHospitals)
hospitalRouter.get('/:id', getHospitalById)

export default hospitalRouter
