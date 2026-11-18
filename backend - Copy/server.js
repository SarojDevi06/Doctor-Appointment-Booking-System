import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './config/mongodb.js'
import userRouter from './routes/userRoute.js'
import doctorRouter from './routes/doctorRoute.js'
import appointmentRouter from './routes/appointmentRoute.js'
import contactRouter from './routes/contactRoute.js'
import adminRouter from './routes/adminRoute.js'
dotenv.config()

const app = express()

// Connect MongoDB
connectDB()

// Middleware
app.use(cors())
app.use(express.json())

// User Routes
app.use('/api/user', userRouter)
app.use('/api/doctor', doctorRouter)
app.use('/api/appointment', appointmentRouter)
app.use('/api/contact', contactRouter)
app.use('/api/admin', adminRouter)

// Test route
app.get('/', (req, res) => {
    res.send('Doctor Appointment Backend is running')
})

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})