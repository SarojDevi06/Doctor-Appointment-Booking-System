import crypto from 'crypto'

// Razorpay sends back a signature after a payment. We calculate the same signature
// with our secret key. If both match, the payment is real.
// A fake "payment successful" message from the browser can never match.
export const isValidPaymentSignature = (orderId, paymentId, signature, secret) => {

    if (!orderId || !paymentId || !signature || !secret) {
        return false
    }

    const expected = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex')

    const expectedBuffer = Buffer.from(expected)
    const givenBuffer = Buffer.from(String(signature))

    // Buffers must have the same length before they can be compared
    if (expectedBuffer.length !== givenBuffer.length) {
        return false
    }

    return crypto.timingSafeEqual(expectedBuffer, givenBuffer)
}
