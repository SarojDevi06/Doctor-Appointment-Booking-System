import jwt from 'jsonwebtoken'

// Creates a middleware that only lets in a logged-in person with the given role.
//   requiredRole : 'patient', 'doctor' or 'admin'
//   idName       : the name under which the logged-in id is stored on req
//                  (example: 'userId' means the route can use req.userId)
const createAuth = (requiredRole, idName) => {

    return (req, res, next) => {

        const token = req.headers.token

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized. Please login again'
            })
        }

        try {
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            )

            console.log("TOKEN VERIFIED:", true)
            console.log("TOKEN ROLE:", decoded.role)

            // Tokens created before roles existed belonged to patients
            const role = decoded.role || 'patient'

            if (role !== requiredRole) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to do this'
                })
            }

            // The id always comes from the token, never from the request body
            req[idName] = decoded.id

            next()

        } catch (error) {
            console.log("JWT ERROR:", error.message);

            return res.status(401).json({
                success: false,
                message: 'Session expired or invalid. Please login again'
            })
        }
    }
}

export default createAuth
