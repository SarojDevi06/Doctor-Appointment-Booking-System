import createAuth from './auth.js'

// Only logged-in admins. The admin id is available as req.adminId
export default createAuth('admin', 'adminId')
