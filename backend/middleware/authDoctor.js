import createAuth from './auth.js'

// Only logged-in doctors. The doctor id is available as req.doctorId
export default createAuth('doctor', 'doctorId')
