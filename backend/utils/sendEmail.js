import nodemailer from 'nodemailer'

// Sends an email. If email is not set up in .env it quietly does nothing,
// so the rest of the application never breaks because of email problems.
const sendEmail = async (to, subject, text) => {

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || !to) {
        return
    }

    // example.com is reserved for tests and examples, nobody owns it
    if (to.endsWith('@example.com')) {
        return
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        })

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject: `Prescripto: ${subject}`,
            text
        })

    } catch (error) {
        console.log('Email failed:', error.message)
    }
}

export default sendEmail
