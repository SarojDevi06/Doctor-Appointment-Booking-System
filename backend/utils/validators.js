// Small helper functions used to check data sent by the user.

// Remove extra spaces and make the email lowercase
export const cleanEmail = (email) => {
    return String(email || '').trim().toLowerCase()
}

export const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Password must be at least 8 characters
export const isValidPassword = (password) => {
    return typeof password === 'string' && password.length >= 8
}

// Phone number: 10 to 15 digits, optional + at the start
export const isValidPhone = (phone) => {
    return /^\+?\d{10,15}$/.test(phone)
}

// MongoDB ids are 24 character hexadecimal strings
export const isValidId = (id) => {
    return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
}

// Stops user text from being treated as HTML (used in emails)
export const escapeHtml = (text) => {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}
