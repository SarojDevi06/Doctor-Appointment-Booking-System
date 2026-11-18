import { timeToMinutes } from './clinicTime.js'
import { APPOINTMENT_STATUS as STATUS } from './constants.js'

// Patients still waiting to be seen, in the order of their appointment time.
// Only confirmed appointments that are not finished yet are in the queue.
export const getWaitingList = (todaysAppointments) => {
    return todaysAppointments
        .filter(item => item.status === STATUS.CONFIRMED && item.queueStatus !== 'Done')
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
}

// Works out the queue position and estimated waiting time of one appointment.
//
//   todaysAppointments : all appointments of ONE doctor for ONE day
//   appointmentId      : the appointment we want to know about
//   slotDuration       : minutes the doctor spends per patient
//
// Estimated wait = patients ahead x minutes per patient.
export const calculateQueue = (todaysAppointments, appointmentId, slotDuration = 30) => {

    const waitingList = getWaitingList(todaysAppointments)

    const index = waitingList.findIndex(item => String(item._id) === String(appointmentId))

    if (index === -1) {
        return null
    }

    const current = waitingList.find(item => item.queueStatus === 'In consultation')

    return {
        position: index + 1,
        patientsAhead: index,
        estimatedWaitMinutes: index * slotDuration,
        nowServingTime: current ? current.time : null,
        queueStatus: waitingList[index].queueStatus
    }
}
