import { MIN_APPOINTMENTS_FOR_RELIABILITY } from './constants.js'

// Reliability = how many confirmed appointments the doctor actually completed.
//
//   reliability % = completed / (completed + cancelled by the doctor) x 100
//
// It comes only from real appointment records. With fewer than
// MIN_APPOINTMENTS_FOR_RELIABILITY records the percentage is not shown,
// because a number based on 1 or 2 visits would be misleading.
export const calculateReliability = (completed = 0, cancelledByDoctor = 0) => {

    const total = completed + cancelledByDoctor

    if (total < MIN_APPOINTMENTS_FOR_RELIABILITY) {
        return { percent: null, total, completed, cancelledByDoctor }
    }

    return {
        percent: Math.round((completed / total) * 100),
        total,
        completed,
        cancelledByDoctor
    }
}
