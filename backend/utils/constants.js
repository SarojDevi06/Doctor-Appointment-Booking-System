// Values used in many places. Keeping them here means each one is defined only once.

export const APPOINTMENT_STATUS = {
    PENDING: 'Pending',       // patient asked, doctor has not answered yet
    CONFIRMED: 'Confirmed',   // doctor accepted
    REJECTED: 'Rejected',     // doctor refused the request
    COMPLETED: 'Completed',   // the visit happened
    CANCELLED: 'Cancelled',   // cancelled by patient, doctor or admin
    NO_SHOW: 'No-Show'        // patient did not come
}

// Statuses where the time slot is still taken
export const ACTIVE_STATUSES = ['Pending', 'Confirmed']

// How many days ahead a patient can book
export const MAX_BOOKING_DAYS = 30

// A doctor's reliability % is shown only after this many finished appointments
export const MIN_APPOINTMENTS_FOR_RELIABILITY = 5

// Slot lengths (in minutes) a doctor can choose
export const ALLOWED_SLOT_DURATIONS = [10, 15, 20, 30, 45, 60]

export const HOSPITAL_TYPES = ['Hospital', 'Clinic', 'Independent Clinic']
