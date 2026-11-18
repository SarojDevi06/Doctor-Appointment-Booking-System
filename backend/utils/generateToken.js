import jwt from 'jsonwebtoken'

// Creates a login token. The role tells us who is logged in:
// 'patient', 'doctor' or 'admin'
const generateToken = (id, role, expiresIn = '7d') => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn })
}

export default generateToken
