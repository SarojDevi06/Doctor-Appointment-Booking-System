import doctorModel from '../models/doctorModel.js'

// Use after authDoctor. Only lets in doctors that the admin has approved.
// Loads the doctor and makes it available as req.doctor.
const requireApproved = async (req, res, next) => {

    try {
        const doctor = await doctorModel.findById(req.doctorId).select('-password')

        if (!doctor) {
            return res.status(401).json({
                success: false,
                message: 'Doctor account not found'
            })
        }

        if (doctor.approvalStatus === 'pending') {
            return res.status(403).json({
                success: false,
                message: 'Your registration is waiting for admin approval'
            })
        }

        if (doctor.approvalStatus === 'rejected') {
            return res.status(403).json({
                success: false,
                message: 'Your registration was rejected by the admin'
            })
        }

        req.doctor = doctor

        next()

    } catch (error) {
        console.log(error)

        res.status(500).json({
            success: false,
            message: 'Something went wrong on the server'
        })
    }
}

export default requireApproved
