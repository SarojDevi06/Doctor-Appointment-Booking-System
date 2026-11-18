import {
    getDayOfWeek,
    getNow,
    minutesToTime,
    timeToMinutes,
    addDays
} from './clinicTime.js'
import { MAX_BOOKING_DAYS } from './constants.js'

// Working hours used when a doctor has not set their own yet: Monday to Saturday, 10:00 - 17:00
export const defaultAvailability = [1, 2, 3, 4, 5, 6].map(day => ({
    day,
    startTime: '10:00',
    endTime: '17:00'
}))

// Returns an error message if the date cannot be booked, or null if it is fine
export const checkBookingDate = (date, now = getNow()) => {

    if (date < now.date) {
        return 'You cannot book a date in the past'
    }

    if (date > addDays(now.date, MAX_BOOKING_DAYS)) {
        return `You can only book up to ${MAX_BOOKING_DAYS} days ahead`
    }

    return null
}

// Builds all the time slots a doctor offers on one date.
//
//   doctor      : needs availability, slotDuration, unavailableDates
//   date        : "2026-11-05"
//   bookedTimes : times already taken, for example ["10:00", "10:30"]
//
// Returns a list like [{ time: "10:00", available: true }, ...]
export const generateSlots = (doctor, date, bookedTimes = [], now = getNow()) => {

    // Doctor is on leave that day
    if ((doctor.unavailableDates || []).includes(date)) {
        return []
    }

    // A doctor who never set working hours (availability is missing) gets the default.
    // An empty list means the doctor chose to work on no days.
    const schedule = doctor.availability ? doctor.availability : defaultAvailability

    const slotLength = doctor.slotDuration || 30
    const dayOfWeek = getDayOfWeek(date)
    const times = new Set()

    schedule
        .filter(entry => entry.day === dayOfWeek)
        .forEach((entry) => {

            const start = timeToMinutes(entry.startTime)
            const end = timeToMinutes(entry.endTime)

            // A slot is only added if it fits completely before the end time
            for (let minutes = start; minutes + slotLength <= end; minutes += slotLength) {

                // For today, hide slots that have already started
                if (date === now.date && minutes <= now.minutes) {
                    continue
                }

                times.add(minutesToTime(minutes))
            }
        })

    return [...times]
        .sort()
        .map(time => ({
            time,
            available: !bookedTimes.includes(time)
        }))
}

// True if this exact time is one of the doctor's slots on that date
export const isSlotOffered = (doctor, date, time, now = getNow()) => {
    return generateSlots(doctor, date, [], now).some(slot => slot.time === time)
}
