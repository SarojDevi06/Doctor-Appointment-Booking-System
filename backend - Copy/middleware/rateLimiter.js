import rateLimit from 'express-rate-limit'

// Limits login/register attempts to slow down password guessing
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many attempts. Please try again after 15 minutes'
    }
})

// Limits the contact form so it cannot be used to spam emails
export const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many messages sent. Please try again later'
    }
})
