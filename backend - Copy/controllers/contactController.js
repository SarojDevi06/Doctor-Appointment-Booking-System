import contactModel from '../models/contactModel.js'
import nodemailer from 'nodemailer'
import { cleanEmail, isValidEmail, escapeHtml } from '../utils/validators.js'

const submitContact = async (req, res) => {
    try {

        const { name, phone, subject, message } = req.body || {}
        const email = cleanEmail(req.body?.email)


        // Check all fields
        if (!name || !email || !phone || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Please fill all fields'
            })
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            })
        }

        if (String(message).length > 2000) {
            return res.status(400).json({
                success: false,
                message: 'Message is too long (maximum 2000 characters)'
            })
        }


        // Save contact query in MongoDB
        await contactModel.create({
            name,
            email,
            phone,
            subject,
            message
        })


        // The query is saved, so the user gets a success message
        // even if the notification email fails
        try {

            const transporter = nodemailer.createTransport({
                service: 'gmail',

                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                }
            })

            // escapeHtml makes sure user text cannot inject HTML into the email
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.CONTACT_RECEIVER,
                replyTo: email,
                subject: `New Contact Query: ${escapeHtml(subject)}`,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                        <h2>New Contact Query</h2>
                        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
                        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
                        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
                        <p><strong>Message:</strong></p>
                        <p>${escapeHtml(message)}</p>
                        <hr />
                        <p>
                            This message was sent from the Doctor Appointment
                            Booking System contact form.
                        </p>
                    </div>
                `
            })

        } catch (emailError) {
            console.log('Contact email failed:', emailError.message)
        }


        res.status(201).json({
            success: true,
            message: 'Your query has been submitted successfully'
        })


    } catch (error) {

        console.log('Contact Error:', error)

        res.status(500).json({
            success: false,
            message: 'Failed to submit your query'
        })
    }
}


export { submitContact }
