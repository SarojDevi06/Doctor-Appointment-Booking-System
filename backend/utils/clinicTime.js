// All appointment dates and times are in the clinic's time zone (India by default).
// Dates look like "2026-11-05" and times like "14:30" (24 hour clock).

const TIME_ZONE = process.env.CLINIC_TIMEZONE || 'Asia/Kolkata'

// Returns today's date and the current time in minutes since midnight
export const getNow = (now = new Date()) => {

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(now)

    const get = (type) => parts.find(part => part.type === type).value

    return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        minutes: Number(get('hour')) * 60 + Number(get('minute'))
    }
}

// "2026-11-05" -> true / false (also rejects dates like 2026-02-31)
export const isValidDate = (date) => {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false
    }

    const parsed = new Date(date + 'T00:00:00Z')

    return !isNaN(parsed) && parsed.toISOString().slice(0, 10) === date
}

// "14:30" -> true / false
export const isValidTime = (time) => {
    return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

// "14:30" -> 870 (minutes since midnight)
export const timeToMinutes = (time) => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
}

// 870 -> "14:30"
export const minutesToTime = (totalMinutes) => {
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
    const minutes = String(totalMinutes % 60).padStart(2, '0')
    return `${hours}:${minutes}`
}

// "2026-11-05" -> 4 (0 = Sunday ... 6 = Saturday)
export const getDayOfWeek = (date) => {
    return new Date(date + 'T00:00:00Z').getUTCDay()
}

// Adds days to a date string: ("2026-11-05", 3) -> "2026-11-08"
export const addDays = (date, days) => {
    const result = new Date(date + 'T00:00:00Z')
    result.setUTCDate(result.getUTCDate() + days)
    return result.toISOString().slice(0, 10)
}
