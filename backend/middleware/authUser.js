import createAuth from './auth.js'

// Only logged-in patients. The patient id is available as req.userId
export default createAuth('patient', 'userId')
