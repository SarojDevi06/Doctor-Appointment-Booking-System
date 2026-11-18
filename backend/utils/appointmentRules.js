import { APPOINTMENT_STATUS as STATUS } from './constants.js'

// Which status can change into which status, depending on who is changing it.
// Anything not listed here is not allowed.
const doctorRules = {
    [STATUS.PENDING]: [STATUS.CONFIRMED, STATUS.REJECTED, STATUS.CANCELLED],
    [STATUS.CONFIRMED]: [STATUS.COMPLETED, STATUS.CANCELLED, STATUS.NO_SHOW]
}

const patientRules = {
    [STATUS.PENDING]: [STATUS.CANCELLED],
    [STATUS.CONFIRMED]: [STATUS.CANCELLED]
}

const adminRules = {
    [STATUS.PENDING]: [STATUS.CANCELLED],
    [STATUS.CONFIRMED]: [STATUS.CANCELLED]
}

const rulesByRole = {
    doctor: doctorRules,
    patient: patientRules,
    admin: adminRules
}

export const canChangeStatus = (role, fromStatus, toStatus) => {
    const allowed = (rulesByRole[role] || {})[fromStatus] || []
    return allowed.includes(toStatus)
}

// Rejected and cancelled appointments give the time slot back to other patients
export const freesSlot = (status) => {
    return status === STATUS.REJECTED || status === STATUS.CANCELLED
}

// Builds the text used to block a slot. The database has a unique index on this
// field, so two patients can never hold the same doctor, date and time.
export const makeSlotKey = (doctorId, date, time) => {
    return `${doctorId}_${date}_${time}`
}
