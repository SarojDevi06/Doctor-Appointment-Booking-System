import React from 'react'
import { assets } from '../assets/assets_frontend/assets'

const About = () => {
    return (
        <div className='mt-10'>

            {/* Page Heading */}

            <div className='text-center text-2xl pt-8 text-gray-700'>

                <p>
                    ABOUT <span className='text-gray-900 font-medium'>US</span>
                </p>

            </div>


            {/* About Section */}

            <div className='my-10 flex flex-col md:flex-row gap-12 items-center'>

                {/* Image */}

                <div className='w-full md:w-1/2'>

                    <img
                        src={assets.about_image}
                        alt='about'
                        className='w-full max-w-md mx-auto rounded-lg'
                    />

                </div>


                {/* Content */}

                <div className='w-full md:w-1/2 flex flex-col gap-5 text-gray-600 text-sm leading-7'>

                    <p>
                        Welcome to our Doctor Appointment Booking System.
                        Our platform makes it easier for patients to find
                        doctors and book appointments online.
                    </p>

                    <p>
                        Patients can browse through different doctors,
                        check their specialities and select a suitable
                        appointment date and time.
                    </p>

                    <p>
                        Our goal is to provide a simple and convenient
                        healthcare appointment experience for patients,
                        doctors and administrators.
                    </p>

                    <p className='font-medium text-gray-800 text-base'>
                        Our Vision
                    </p>

                    <p>
                        We aim to make healthcare appointment management
                        more accessible, organized and user-friendly through
                        a web-based platform.
                    </p>

                </div>

            </div>


            {/* Why Choose Us */}

            <div className='text-xl my-8'>

                <p>
                    WHY <span className='text-gray-800 font-semibold'>
                        CHOOSE US
                    </span>
                </p>

            </div>


            <div className='flex flex-col md:flex-row mb-20'>

                <div className='border px-8 md:px-12 py-8 flex flex-col gap-4 text-sm text-gray-600 hover:bg-blue-50 transition'>
                    <p className='font-semibold text-gray-800'>
                        EASY APPOINTMENT BOOKING
                    </p>

                    <p>
                        Book appointments with doctors easily by selecting
                        a suitable date and available time slot.
                    </p>
                </div>


                <div className='border border-l-0 px-8 md:px-12 py-8 flex flex-col gap-4 text-sm text-gray-600 hover:bg-blue-50 transition'>
                    <p className='font-semibold text-gray-800'>
                        QUALIFIED DOCTORS
                    </p>

                    <p>
                        Browse doctors according to their speciality and
                        view their information before booking an appointment.
                    </p>
                </div>


                <div className='border border-l-0 px-8 md:px-12 py-8 flex flex-col gap-4 text-sm text-gray-600 hover:bg-blue-50 transition'>
                    <p className='font-semibold text-gray-800'>
                        SIMPLE AND CONVENIENT
                    </p>

                    <p>
                        Manage your appointments and profile through a
                        simple and user-friendly interface.
                    </p>
                </div>

            </div>

        </div>
    )
}

export default About