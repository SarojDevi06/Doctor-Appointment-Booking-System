import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import connectDB from './config/mongodb.js'
import userRouter from './routes/userRoute.js'
import doctorRouter from './routes/doctorRoute.js'
import appointmentRouter from './routes/appointmentRoute.js'
import contactRouter from './routes/contactRoute.js'
import adminRouter from './routes/adminRoute.js'
import hospitalRouter from './routes/hospitalRoute.js'
import notificationRouter from './routes/notificationRoute.js'
import paymentRouter from './routes/paymentRoute.js'
import assistantRouter from './routes/assistantRoute.js'
import publicRouter from './routes/publicRoute.js'
import { uploadFolder } from './middleware/upload.js'

dotenv.config()

// The server cannot work safely without these
if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) {
    console.log('JWT_SECRET and MONGODB_URI must be set in the .env file')
    process.exit(1)
}

const app = express()

// Connect MongoDB
connectDB()

// Middleware
// helmet adds safe security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// Only our own frontend is allowed to call this API from a browser
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173'
}))

app.use(express.json({ limit: '1mb' }))

// Routes
app.use('/api/user', userRouter)
app.use('/api/doctor', doctorRouter)
app.use('/api/appointment', appointmentRouter)
app.use('/api/contact', contactRouter)
app.use('/api/admin', adminRouter)
app.use('/api/hospital', hospitalRouter)
app.use('/api/notification', notificationRouter)
app.use('/api/payment', paymentRouter)
app.use('/api/assistant', assistantRouter)
app.use('/api/public', publicRouter)

// Uploaded photos (doctor and patient images)
app.use('/uploads', express.static(uploadFolder))

// Test route
app.get('/', (req, res) => {
    res.send('Doctor Appointment Backend is running')
})

// Unknown route
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    })
})

// Any error that was not handled inside a controller ends up here
app.use((error, req, res, next) => {

    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON in request body'
        })
    }

    console.log(error)

    res.status(500).json({
        success: false,
        message: 'Something went wrong on the server'
    })
})

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
