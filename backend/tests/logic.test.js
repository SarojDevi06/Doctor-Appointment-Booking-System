// Tests for the logic that needs no database.  Run with:  npm test
import test from 'node:test'
import assert from 'node:assert/strict'

import { getNow, isValidDate, isValidTime, getDayOfWeek, addDays } from '../utils/clinicTime.js'
import { generateSlots, isSlotOffered, checkBookingDate, defaultAvailability } from '../utils/slots.js'
import { canChangeStatus, freesSlot, makeSlotKey } from '../utils/appointmentRules.js'
import { calculateQueue, getWaitingList } from '../utils/queue.js'
import { calculateReliability } from '../utils/reliability.js'
import { getPagination, escapeRegex } from '../utils/pagination.js'

// A fixed "now": Monday 2026-11-02, 10:15 in India
const now = { date: '2026-11-02', minutes: 10 * 60 + 15 }

test('dates and times are validated', () => {
    assert.equal(isValidDate('2026-11-05'), true)
    assert.equal(isValidDate('2026-02-31'), false)
    assert.equal(isValidDate('26 Sep 2026'), false)
    assert.equal(isValidDate(undefined), false)
    assert.equal(isValidTime('14:30'), true)
    assert.equal(isValidTime('24:00'), false)
    assert.equal(isValidTime('10:00 AM'), false)
})

test('day of week and adding days', () => {
    assert.equal(getDayOfWeek('2026-11-02'), 1)   // Monday
    assert.equal(getDayOfWeek('2026-11-08'), 0)   // Sunday
    assert.equal(addDays('2026-11-30', 1), '2026-12-01')
    assert.equal(addDays('2026-12-31', 1), '2027-01-01')
})

test('getNow uses the clinic time zone', () => {
    // 2026-11-02 20:00 UTC is 2026-11-03 01:30 in India
    const result = getNow(new Date('2026-11-02T20:00:00Z'))
    assert.deepEqual(result, { date: '2026-11-03', minutes: 90 })
})

test('slots follow the weekly schedule and slot length', () => {
    const doctor = { availability: [{ day: 3, startTime: '09:00', endTime: '11:00' }], slotDuration: 30 }
    // 2026-11-04 is a Wednesday
    const slots = generateSlots(doctor, '2026-11-04', [], now)
    assert.deepEqual(slots.map(slot => slot.time), ['09:00', '09:30', '10:00', '10:30'])
    assert.ok(slots.every(slot => slot.available))
    // Tuesday: doctor does not work
    assert.deepEqual(generateSlots(doctor, '2026-11-03', [], now), [])
})

test('a slot that does not fit before closing time is not offered', () => {
    const doctor = { availability: [{ day: 3, startTime: '09:00', endTime: '10:20' }], slotDuration: 30 }
    assert.deepEqual(generateSlots(doctor, '2026-11-04', [], now).map(s => s.time), ['09:00', '09:30'])
})

test('booked slots are marked unavailable', () => {
    const doctor = { availability: [{ day: 3, startTime: '09:00', endTime: '10:00' }], slotDuration: 30 }
    const slots = generateSlots(doctor, '2026-11-04', ['09:30'], now)
    assert.deepEqual(slots, [{ time: '09:00', available: true }, { time: '09:30', available: false }])
})

test('slots that already started today are hidden', () => {
    const doctor = { availability: [{ day: 1, startTime: '09:00', endTime: '12:00' }], slotDuration: 30 }
    // now is 10:15 on Monday 2026-11-02
    const times = generateSlots(doctor, '2026-11-02', [], now).map(slot => slot.time)
    assert.deepEqual(times, ['10:30', '11:00', '11:30'])
})

test('leave days have no slots', () => {
    const doctor = { availability: [{ day: 3, startTime: '09:00', endTime: '10:00' }], unavailableDates: ['2026-11-04'] }
    assert.deepEqual(generateSlots(doctor, '2026-11-04', [], now), [])
})

test('two working periods on the same day (morning and evening)', () => {
    const doctor = {
        availability: [
            { day: 3, startTime: '09:00', endTime: '10:00' },
            { day: 3, startTime: '17:00', endTime: '18:00' }
        ],
        slotDuration: 30
    }
    assert.deepEqual(generateSlots(doctor, '2026-11-04', [], now).map(s => s.time), ['09:00', '09:30', '17:00', '17:30'])
})

test('doctors without a schedule use the default (Mon-Sat 10-17)', () => {
    assert.equal(defaultAvailability.length, 6)
    const slots = generateSlots({}, '2026-11-04', [], now)
    assert.equal(slots[0].time, '10:00')
    assert.equal(slots.at(-1).time, '16:30')
    // Sunday is closed
    assert.deepEqual(generateSlots({}, '2026-11-08', [], now), [])
})

test('an empty working-hours list means closed, not "use the default"', () => {
    assert.deepEqual(generateSlots({ availability: [] }, '2026-11-04', [], now), [])
    assert.ok(generateSlots({ availability: undefined }, '2026-11-04', [], now).length > 0)
})

test('isSlotOffered only accepts real slots', () => {
    const doctor = { availability: [{ day: 3, startTime: '09:00', endTime: '10:00' }], slotDuration: 30 }
    assert.equal(isSlotOffered(doctor, '2026-11-04', '09:30', now), true)
    assert.equal(isSlotOffered(doctor, '2026-11-04', '09:45', now), false)
    assert.equal(isSlotOffered(doctor, '2026-11-04', '23:00', now), false)
})

test('booking window: no past dates and not more than 30 days ahead', () => {
    assert.equal(checkBookingDate('2026-11-02', now), null)
    assert.equal(checkBookingDate('2026-12-02', now), null)
    assert.match(checkBookingDate('2026-11-01', now), /past/)
    assert.match(checkBookingDate('2026-12-03', now), /30 days/)
})

test('status rules per role', () => {
    assert.equal(canChangeStatus('doctor', 'Pending', 'Confirmed'), true)
    assert.equal(canChangeStatus('doctor', 'Pending', 'Rejected'), true)
    assert.equal(canChangeStatus('doctor', 'Pending', 'Completed'), false)   // must confirm first
    assert.equal(canChangeStatus('doctor', 'Confirmed', 'Completed'), true)
    assert.equal(canChangeStatus('doctor', 'Confirmed', 'No-Show'), true)
    assert.equal(canChangeStatus('doctor', 'Completed', 'Cancelled'), false)
    assert.equal(canChangeStatus('doctor', 'Cancelled', 'Confirmed'), false)
    assert.equal(canChangeStatus('patient', 'Pending', 'Cancelled'), true)
    assert.equal(canChangeStatus('patient', 'Confirmed', 'Cancelled'), true)
    assert.equal(canChangeStatus('patient', 'Pending', 'Confirmed'), false)   // patients cannot confirm
    assert.equal(canChangeStatus('patient', 'Completed', 'Cancelled'), false)
    assert.equal(canChangeStatus('admin', 'Confirmed', 'Cancelled'), true)
    assert.equal(canChangeStatus('hacker', 'Pending', 'Confirmed'), false)
})

test('only rejected and cancelled appointments free the slot', () => {
    assert.equal(freesSlot('Rejected'), true)
    assert.equal(freesSlot('Cancelled'), true)
    assert.equal(freesSlot('Confirmed'), false)
    assert.equal(freesSlot('Completed'), false)
    assert.equal(makeSlotKey('abc', '2026-11-04', '09:00'), 'abc_2026-11-04_09:00')
})

test('queue position and estimated waiting time', () => {
    const today = [
        { _id: 'a', time: '09:00', status: 'Confirmed', queueStatus: 'Done' },
        { _id: 'b', time: '09:30', status: 'Confirmed', queueStatus: 'In consultation' },
        { _id: 'c', time: '10:00', status: 'Confirmed', queueStatus: 'Waiting' },
        { _id: 'd', time: '10:30', status: 'Confirmed', queueStatus: 'Not arrived' },
        { _id: 'e', time: '09:45', status: 'Cancelled', queueStatus: 'Not arrived' },
        { _id: 'f', time: '11:00', status: 'Pending', queueStatus: 'Not arrived' }
    ]

    assert.deepEqual(getWaitingList(today).map(item => item._id), ['b', 'c', 'd'])

    const forC = calculateQueue(today, 'c', 20)
    assert.equal(forC.position, 2)
    assert.equal(forC.patientsAhead, 1)
    assert.equal(forC.estimatedWaitMinutes, 20)
    assert.equal(forC.nowServingTime, '09:30')

    assert.equal(calculateQueue(today, 'b', 20).estimatedWaitMinutes, 0)
    assert.equal(calculateQueue(today, 'd', 20).estimatedWaitMinutes, 40)
    assert.equal(calculateQueue(today, 'a', 20), null)   // already done
    assert.equal(calculateQueue(today, 'e', 20), null)   // cancelled
    assert.equal(calculateQueue(today, 'f', 20), null)   // not confirmed yet
})

test('queue works with ids that are not strings (MongoDB ObjectIds)', () => {
    const id = { toString: () => 'xyz' }
    const today = [{ _id: id, time: '09:00', status: 'Confirmed', queueStatus: 'Waiting' }]
    assert.equal(calculateQueue(today, 'xyz', 30).position, 1)
})

test('reliability is hidden until there are enough real records', () => {
    assert.equal(calculateReliability(0, 0).percent, null)
    assert.equal(calculateReliability(3, 1).percent, null)      // 4 records
    assert.equal(calculateReliability(4, 1).percent, 80)        // 5 records
    assert.equal(calculateReliability(10, 0).percent, 100)
    assert.equal(calculateReliability(18, 2).percent, 90)
    assert.equal(calculateReliability(1, 9).percent, 10)
    assert.equal(calculateReliability(18, 2).total, 20)
})

test('pagination is safe', () => {
    assert.deepEqual(getPagination({}), { page: 1, limit: 10, skip: 0 })
    assert.deepEqual(getPagination({ page: '3', limit: '20' }), { page: 3, limit: 20, skip: 40 })
    assert.equal(getPagination({ page: '-5' }).page, 1)
    assert.equal(getPagination({ limit: '99999' }).limit, 100)
    assert.equal(getPagination({ page: 'abc' }).page, 1)
})

test('search text cannot break the regular expression', () => {
    const regex = new RegExp(escapeRegex('dr. (smith)+'), 'i')
    assert.equal(regex.test('Dr. (Smith)+'), true)
    assert.equal(regex.test('drx smithh'), false)
})
