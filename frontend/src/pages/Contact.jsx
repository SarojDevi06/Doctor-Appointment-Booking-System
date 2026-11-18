import React, { useState } from 'react'
import { assets } from '../assets/assets_frontend/assets'

const Contact = () => {

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
    })

    const [loading, setLoading] = useState(false)

    const handleChange = (event) => {
        const { name, value } = event.target

        setFormData({
            ...formData,
            [name]: value
        })
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        try {

            setLoading(true)

            const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/contact/submit`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                }
            )

            const data = await response.json()

            if (data.success) {

                alert(data.message)

                setFormData({
                    name: '',
                    email: '',
                    phone: '',
                    subject: '',
                    message: ''
                })

            } else {

                alert(data.message)

            }

        } catch (error) {

            console.log(error)

            alert('Failed to submit your query. Please try again.')

        } finally {

            setLoading(false)

        }
    }

    return (

        <div className='mt-10'>

            {/* Heading */}

            <div className='text-center text-2xl pt-8 text-gray-700'>

                <p>
                    CONTACT <span className='text-gray-900 font-medium'>
                        US
                    </span>
                </p>

            </div>


            {/* Contact Section */}

            <div className='my-10 flex flex-col md:flex-row gap-12 items-start'>

                {/* Image + Contact Information */}

                <div className='w-full md:w-1/2'>

                    <img
                        src={assets.contact_image}
                        alt='contact'
                        className='w-full max-w-md mx-auto rounded-lg'
                    />

                    <div className='mt-8 flex flex-col gap-5 text-gray-600'>

                        <h2 className='text-xl font-semibold text-gray-800'>
                            Get In Touch
                        </h2>

                        <p className='text-sm leading-6'>
                            If you have any questions or need help with
                            appointment booking, feel free to contact us.
                        </p>

                        <div>

                            <p className='font-medium text-gray-800'>
                                Our Office
                            </p>

                            <p className='text-sm mt-2'>
                                Akal College of Engineering and Technology
                            </p>

                            <p className='text-sm'>
                                Baru Sahib, Himachal Pradesh
                            </p>

                        </div>

                        <div>

                            <p className='font-medium text-gray-800'>
                                Phone
                            </p>

                            <p className='text-sm mt-2'>
                                +91 9876543210
                            </p>

                        </div>

                        <div>

                            <p className='font-medium text-gray-800'>
                                Email
                            </p>

                            <p className='text-sm mt-2'>
                                n08806934@gmail.com
                            </p>

                        </div>

                    </div>

                </div>


                {/* Contact Form */}

                <div className='w-full md:w-1/2'>

                    <div className='border border-gray-200 rounded-lg p-6 sm:p-8 shadow-sm'>

                        <h2 className='text-xl font-semibold text-gray-800 mb-2'>
                            Send Us a Message
                        </h2>

                        <p className='text-sm text-gray-500 mb-6'>
                            Please fill in your details and we will get back
                            to you.
                        </p>

                        <form
                            onSubmit={handleSubmit}
                            className='flex flex-col gap-4'
                        >

                            {/* Name */}

                            <div>

                                <label className='block text-sm text-gray-700 mb-1'>
                                    Name
                                </label>

                                <input
                                    type='text'
                                    name='name'
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder='Enter your name'
                                    pattern='[A-Za-z ]{3,50}'
                                    title='Name should contain only letters and spaces (minimum 3 characters)'
                                    required
                                    className='w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-primary'
                                />

                            </div>


                            {/* Email */}

                            <div>

                                <label className='block text-sm text-gray-700 mb-1'>
                                    Email
                                </label>

                                <input
                                    type='email'
                                    name='email'
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder='Enter your email'
                                    title='Please enter a valid email address'
                                    required
                                    className='w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-primary'
                                />

                            </div>


                            {/* Phone */}

                            <div>

                                <label className='block text-sm text-gray-700 mb-1'>
                                    Phone Number
                                </label>

                                <input
                                    type='tel'
                                    name='phone'
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder='Enter 10 digit phone number'
                                    pattern='[0-9]{10}'
                                    title='Phone number must contain exactly 10 digits'
                                    maxLength='10'
                                    required
                                    className='w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-primary'
                                />

                            </div>


                            {/* Subject */}

                            <div>

                                <label className='block text-sm text-gray-700 mb-1'>
                                    Subject
                                </label>

                                <input
                                    type='text'
                                    name='subject'
                                    value={formData.subject}
                                    onChange={handleChange}
                                    placeholder='Enter subject'
                                    minLength='3'
                                    maxLength='100'
                                    title='Subject must contain at least 3 characters'
                                    required
                                    className='w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-primary'
                                />

                            </div>


                            {/* Message */}

                            <div>

                                <label className='block text-sm text-gray-700 mb-1'>
                                    Message
                                </label>

                                <textarea
                                    name='message'
                                    value={formData.message}
                                    onChange={handleChange}
                                    placeholder='Write your message here...'
                                    rows='5'
                                    minLength='10'
                                    maxLength='500'
                                    title='Message must contain at least 10 characters'
                                    required
                                    className='w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none resize-none focus:border-primary'
                                ></textarea>

                            </div>


                            {/* Submit Button */}

                            <button
                                type='submit'
                                disabled={loading}
                                className='bg-primary text-white px-8 py-3 rounded-lg w-full hover:opacity-90 transition disabled:opacity-50'
                            >

                                {loading
                                    ? 'Sending...'
                                    : 'Send Message'
                                }

                            </button>

                        </form>

                    </div>

                </div>

            </div>

        </div>
    )
}

export default Contact