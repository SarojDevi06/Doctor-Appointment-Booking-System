// More tests that need no database. Run with:  npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'

import { getAssistantReply } from '../utils/assistantRules.js'
import { isValidPaymentSignature } from '../utils/payment.js'
import { formatSlot } from '../utils/notify.js'

const ask = (message) => getAssistantReply(message)

test('assistant: empty message', () => {
    assert.equal(ask('').type, 'empty')
    assert.equal(ask(undefined).type, 'empty')
})

test('assistant: emergencies are detected first', () => {
    const result = ask('I have severe chest pain and cannot breathe')
    assert.equal(result.type, 'emergency')
    assert.match(result.reply, /112/)
    assert.deepEqual(result.specialities, [])
    assert.equal(ask('my father had a stroke').type, 'emergency')
})

test('assistant: self-harm gets a caring reply with support numbers, not a doctor list', () => {
    const result = ask('I want to end my life')
    assert.equal(result.type, 'emergency')
    assert.match(result.reply, /14416/)
    assert.match(result.reply, /112/)
})

test('assistant: symptoms suggest a speciality, never a diagnosis', () => {
    const skin = ask('I have a skin rash and itching')
    assert.equal(skin.type, 'speciality')
    assert.deepEqual(skin.specialities, ['Dermatologist'])
    assert.ok(skin.disclaimer.includes('not a doctor'))
    assert.ok(!/you have|you are suffering|diagnos(is|ed) (is|as)/i.test(skin.reply))

    assert.ok(ask('my stomach hurts and I feel nausea').specialities.includes('Gastroenterologist'))
    assert.ok(ask('I think I am pregnant').specialities.includes('Gynecologist'))
    assert.ok(ask('my baby has a fever').specialities.includes('Pediatricians'))
    assert.ok(ask('I feel anxiety and cannot focus').specialities.includes('Psychiatrist'))
    assert.ok(ask('terrible toothache, my tooth hurts').specialities.includes('Dentist'))
})

test('assistant: whole-word matching avoids silly matches', () => {
    // "year" must not match "ear", "kidney" must not match "kid", "heartburn" is not "heart"
    assert.deepEqual(ask('this year is going well').specialities, [])
    assert.ok(!ask('kidney problem').specialities.includes('Pediatricians'))
    const heartburn = ask('I have heartburn')
    assert.ok(heartburn.specialities.includes('Gastroenterologist'))
    assert.ok(!heartburn.specialities.includes('Cardiologist'))
    assert.ok(ask('my ear is paining').specialities.includes('ENT'))
})

test('assistant: at most 3 suggestions', () => {
    const result = ask('skin rash, stomach pain, headache, tooth pain, eye pain, joint pain')
    assert.ok(result.specialities.length <= 3)
})

test('assistant: website help answers', () => {
    assert.match(ask('how do I book an appointment?').reply, /Doctors/)
    assert.match(ask('how can I cancel').reply, /My appointments/)
    assert.match(ask('can I reschedule?').reply, /new date/)
    assert.match(ask('what does pending mean').reply, /Pending/)
    assert.match(ask('how much are the fees').reply, /fee/i)
    assert.match(ask('how long is the waiting time').reply, /queue/i)
    assert.match(ask('how is reliability calculated').reply, /real appointment records/)
    assert.match(ask('how do I register as doctor').reply, /admin approves/)
})

test('assistant: greeting and unknown', () => {
    assert.equal(ask('hello').type, 'greeting')
    assert.equal(ask('what is the capital of france').type, 'unknown')
})

test('payment signature: only the real signature is accepted', () => {
    const secret = 'test_secret'
    const orderId = 'order_ABC123'
    const paymentId = 'pay_XYZ789'
    const realSignature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')

    assert.equal(isValidPaymentSignature(orderId, paymentId, realSignature, secret), true)
    assert.equal(isValidPaymentSignature(orderId, paymentId, 'f'.repeat(64), secret), false)
    assert.equal(isValidPaymentSignature(orderId, paymentId, 'short', secret), false)
    assert.equal(isValidPaymentSignature('order_OTHER', paymentId, realSignature, secret), false)
    assert.equal(isValidPaymentSignature(orderId, 'pay_OTHER', realSignature, secret), false)
    assert.equal(isValidPaymentSignature(orderId, paymentId, realSignature, 'wrong_secret'), false)
    assert.equal(isValidPaymentSignature(orderId, paymentId, undefined, secret), false)
    assert.equal(isValidPaymentSignature(orderId, paymentId, realSignature, undefined), false)
})

test('slot text for notifications', () => {
    assert.equal(formatSlot('2026-11-05', '14:30'), '05 Nov 2026 at 2:30 PM')
    assert.equal(formatSlot('2026-12-01', '09:00'), '01 Dec 2026 at 9:00 AM')
    assert.equal(formatSlot('2026-12-01', '00:00'), '01 Dec 2026 at 12:00 AM')
    assert.equal(formatSlot('2026-12-01', '12:00'), '01 Dec 2026 at 12:00 PM')
    // old appointments with the old format do not crash
    assert.equal(formatSlot('26 Sep 2026', '10:00 AM'), '26 Sep 2026 10:00 AM')
})
