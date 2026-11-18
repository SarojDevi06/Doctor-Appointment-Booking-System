import doctorModel from '../models/doctorModel.js'
import { getAssistantReply, DISCLAIMER } from '../utils/assistantRules.js'
import { approvedDoctorFilter } from '../utils/doctorHelpers.js'
import { escapeRegex } from '../utils/pagination.js'

// Asks an AI model for a friendlier answer. This is OPTIONAL: it only runs when
// ANTHROPIC_API_KEY is set in .env. Without a key the rule-based answer is used.
const askAiModel = async (message) => {

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: process.env.ASSISTANT_MODEL || 'claude-haiku-5-5',
            max_tokens: 400,
            system:
                'You are the helper of Prescripto, a doctor appointment website in India. ' +
                'You help users find the right TYPE of doctor and use the website (search doctors, book, cancel, reschedule, appointment status, queue). ' +
                'Never diagnose, never name a disease as the cause of symptoms, never suggest medicines or doses. ' +
                'Always say that a doctor must examine the person. Keep answers under 120 words and simple.',
            messages: [{ role: 'user', content: message }]
        })
    })

    if (!response.ok) {
        throw new Error(`AI request failed with status ${response.status}`)
    }

    const data = await response.json()

    return data.content.map(part => part.text || '').join('').trim()
}

// POST /api/assistant/chat   body: { message }
const chat = async (req, res) => {
    try {
        const message = String(req.body?.message || '').trim()

        if (!message) {
            return res.status(400).json({ success: false, message: 'Please type your question' })
        }

        if (message.length > 500) {
            return res.status(400).json({ success: false, message: 'Your message is too long (maximum 500 characters)' })
        }

        const result = getAssistantReply(message)

        let reply = result.reply

        // The AI model is used only for normal questions.
        // Emergencies always get the fixed safe answer.
        if (process.env.ANTHROPIC_API_KEY && result.type !== 'emergency') {
            try {
                reply = await askAiModel(message)
            } catch (error) {
                console.log('Assistant AI failed, using rule-based answer:', error.message)
            }
        }

        // Real number of doctors for each suggested speciality
        const suggestions = []

        for (const speciality of result.specialities) {
            const doctorCount = await doctorModel.countDocuments({
                speciality: new RegExp(`^${escapeRegex(speciality)}$`, 'i'),
                available: true,
                ...approvedDoctorFilter
            })

            suggestions.push({ speciality, doctorCount })
        }

        res.json({
            success: true,
            type: result.type,
            reply,
            suggestions,
            disclaimer: result.disclaimer || (result.type === 'speciality' ? DISCLAIMER : '')
        })

    } catch (error) {
        console.log(error)

        res.status(500).json({ success: false, message: 'The assistant is not available right now' })
    }
}

export { chat }
