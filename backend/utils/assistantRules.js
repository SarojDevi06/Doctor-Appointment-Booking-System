// The rule-based brain of the Healthcare Assistant.
// It does NOT diagnose anything. It only
//   1. warns when a message sounds like an emergency,
//   2. suggests which kind of doctor (speciality) to look for,
//   3. answers questions about how to use this website.

export const DISCLAIMER =
    'I am not a doctor and this is not medical advice or a diagnosis. A qualified doctor can examine you and tell you what is really going on.'

// Words that can mean a real emergency. The assistant always shows these first.
const emergencyWords = [
    'chest pain', 'heart attack', "can't breathe", 'cannot breathe', 'difficulty breathing',
    'short of breath', 'severe bleeding', 'unconscious', 'fainted', 'stroke',
    'seizure', 'poisoning', 'overdose', 'suicide', 'suicidal', 'kill myself', 'end my life'
]

const selfHarmWords = ['suicide', 'suicidal', 'kill myself', 'end my life']

// Symptom words -> the speciality that usually handles them.
// Names match the speciality names used on the website.
const symptomRules = [
    { speciality: 'Dermatologist', words: ['skin', 'rash', 'acne', 'pimple', 'itch', 'itching', 'hair fall', 'hair loss', 'dandruff', 'eczema', 'allergy'] },
    { speciality: 'Gynecologist', words: ['pregnan*', 'period', 'menstrual', 'pcos', 'periods', 'ovary', 'vaginal', 'menopause'] },
    { speciality: 'Pediatricians', words: ['my child', 'my baby', 'infant', 'toddler', 'newborn', 'my son', 'my daughter', 'kid', 'kids'] },
    { speciality: 'Neurologist', words: ['migraine', 'headache', 'dizziness', 'dizzy', 'numbness', 'tingling', 'memory loss', 'tremor', 'seizure'] },
    { speciality: 'Gastroenterologist', words: ['stomach', 'abdominal', 'acidity', 'vomit', 'nausea', 'diarrhea', 'diarrhoea', 'constipation', 'gas', 'bloating', 'heartburn', 'indigestion', 'liver'] },
    { speciality: 'Cardiologist', words: ['chest pain', 'palpitation', 'blood pressure', 'heart', 'cholesterol'] },
    { speciality: 'Orthopedic', words: ['joint', 'bone', 'fracture', 'back pain', 'knee', 'shoulder', 'neck pain', 'sprain', 'arthritis'] },
    { speciality: 'ENT', words: ['ear', 'ears', 'throat', 'sinus', 'nose', 'tonsil', 'hearing'] },
    { speciality: 'Ophthalmologist', words: ['eye', 'vision', 'blurred', 'cataract'] },
    { speciality: 'Dentist', words: ['tooth', 'teeth', 'dental', 'gum', 'cavity'] },
    { speciality: 'Psychiatrist', words: ['anxiety', 'depress*', 'stress', 'panic', 'insomnia', "can't sleep", 'mental health', 'low mood'] },
    { speciality: 'General physician', words: ['fever', 'cold', 'cough', 'flu', 'fatigue', 'tired', 'weakness', 'body pain', 'sore throat', 'infection', 'diabetes', 'weight'] }
]

// Questions about the website -> ready answers
const helpTopics = [
    {
        words: ['how to book', 'book appointment', 'book an appointment', 'make appointment', 'how do i book', 'booking'],
        answer: 'To book: 1) Open "Doctors" and pick a doctor. 2) Choose an available date and time. 3) Confirm the booking. The doctor then accepts your request, and you can follow its status in "My appointments".'
    },
    {
        words: ['cancel*'],
        answer: 'Open "My appointments" and press Cancel on a Pending or Confirmed appointment. The doctor is told automatically and the time becomes free for others.'
    },
    {
        words: ['reschedule', 'change time', 'change date', 'change my appointment'],
        answer: 'In "My appointments" choose Reschedule, then pick a new date and time. The doctor will be asked to confirm the new time again.'
    },
    {
        words: ['status', 'pending', 'confirmed', 'rejected', 'no-show', 'no show', 'completed'],
        answer: 'Pending means the doctor has not answered yet. Confirmed means the doctor accepted. Rejected means the doctor could not accept it. Completed means the visit is done. Cancelled means it was cancelled. No-Show means the patient did not arrive.'
    },
    {
        words: ['pay', 'payment', 'fee', 'fees', 'cost', 'price', 'refund'],
        answer: 'The consultation fee is shown on every doctor card and is set by the doctor. You can pay online after booking (if enabled) or pay at the clinic. If you cancel a paid appointment, a refund is marked as pending for the admin to process.'
    },
    {
        words: ['wait', 'queue', 'waiting time', 'turn'],
        answer: 'On the day of your visit, "My appointments" shows your place in the clinic queue and an estimated waiting time. The estimate is the number of patients before you multiplied by the doctor\'s time per patient.'
    },
    {
        words: ['reliab*', 'trust', 'rating'],
        answer: 'The reliability score of a doctor is calculated from real appointment records: completed visits compared with appointments the doctor cancelled. It appears only after the doctor has enough finished appointments.'
    },
    {
        words: ['i am a doctor', 'doctor registration', 'register as doctor', 'join as doctor', 'list my clinic'],
        answer: 'Doctors can register from the "Doctor" login page by choosing "Register as doctor". You add your hospital or clinic details, and the admin approves your account before you can accept appointments.'
    },
    {
        words: ['register', 'sign up', 'signup', 'create account', 'account'],
        answer: 'Press "Create account" at the top of the website, enter your name, email and a password with at least 8 characters, and you are logged in.'
    },
    {
        words: ['login', 'log in', 'sign in', 'password'],
        answer: 'Use "Sign in" at the top. Patients, doctors and admins each have their own tab on the login page.'
    },
    {
        words: ['hospital', 'clinic', 'location'],
        answer: 'Each doctor card shows the hospital or clinic where the doctor practices. You can also search doctors by location on the Doctors page.'
    }
]

// Matches whole words only, so "ear" does not match "year" or "heart".
// A word ending in * matches any word that starts with it ("pregnan*" matches "pregnant").
const matchesWord = (text, word) => {

    const isStem = word.endsWith('*')
    const cleanWord = isStem ? word.slice(0, -1) : word

    // Make special characters safe inside a regular expression
    const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const pattern = isStem ? `\\b${escaped}` : `\\b${escaped}\\b`

    return new RegExp(pattern).test(text)
}

const includesAny = (text, words) => words.some(word => matchesWord(text, word))

// Reads the message and returns what the assistant should say
export const getAssistantReply = (message) => {

    const text = String(message || '').toLowerCase().trim()

    if (!text) {
        return { type: 'empty', reply: 'Please type your question.', specialities: [] }
    }

    // 1. Emergencies come first
    if (includesAny(text, emergencyWords)) {

        let reply = 'This may be an emergency. Please call 112 (India emergency number) or go to the nearest hospital emergency department right now. Do not wait for an online appointment.'

        if (includesAny(text, selfHarmWords)) {
            reply = 'I am really sorry you are feeling this way. You deserve support right now. Please call 112 if you are in immediate danger, or call Tele-MANAS at 14416 (free mental health support in India), or tell someone you trust to stay with you.'
        }

        return { type: 'emergency', reply, specialities: [], disclaimer: DISCLAIMER }
    }

    // 2. Questions about using the website
    const topic = helpTopics.find(item => includesAny(text, item.words))

    // 3. Symptom words -> which speciality to look for
    const specialities = symptomRules
        .filter(rule => includesAny(text, rule.words))
        .map(rule => rule.speciality)
        .slice(0, 3)

    if (specialities.length > 0 && !topic) {
        return {
            type: 'speciality',
            reply: `For concerns like this, people usually consult: ${specialities.join(', ')}. If you are not sure, a General physician is a good first step. You can see the available doctors below.`,
            specialities,
            disclaimer: DISCLAIMER
        }
    }

    if (topic) {
        return { type: 'help', reply: topic.answer, specialities: [] }
    }

    if (includesAny(text, ['hello', 'hi', 'hey', 'good morning', 'good evening'])) {
        return {
            type: 'greeting',
            reply: 'Hello! I can help you find the right type of doctor, explain how booking works, or answer questions about appointments, fees and the queue.',
            specialities: []
        }
    }

    return {
        type: 'unknown',
        reply: 'I can help with: finding which type of doctor to see (for example "I have a skin rash"), how to book, cancel or reschedule, appointment status, fees and payment, and the clinic queue. What would you like to know?',
        specialities: []
    }
}
