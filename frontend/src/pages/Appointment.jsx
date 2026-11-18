import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const Appointment = () => {

    const { docId } = useParams()
    const navigate = useNavigate()

    const [doctor, setDoctor] = useState(null)
    const [loading, setLoading] = useState(true)

    const [selectedDate, setSelectedDate] = useState('')
    const [selectedTime, setSelectedTime] = useState('')

    // Get doctor from backend
    useEffect(() => {

        const getDoctor = async () => {

            try {

                const response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/doctor/list`
                )

                const data = await response.json()

                if (data.success) {

                    const selectedDoctor = data.doctors.find(
                        doctor => doctor._id === docId
                    )

                    setDoctor(selectedDoctor)

                } else {

                    alert(data.message)

                }

            } catch (error) {

                console.log(error)
                alert('Failed to load doctor')

            } finally {

                setLoading(false)

            }
        }

        getDoctor()

    }, [docId])


    // Loading
    if (loading) {

        return (
            <div className='flex items-center justify-center py-20'>

                <p className='text-gray-600'>
                    Loading doctor...
                </p>

            </div>
        )

    }


    // Doctor not found
    if (!doctor) {

        return (

            <div className='flex flex-col items-center justify-center py-20'>

                <p className='text-gray-600 text-lg'>
                    Doctor not found
                </p>

                <button
                    onClick={() => navigate('/doctors')}
                    className='mt-5 bg-primary text-white px-6 py-2 rounded-full'
                >
                    Back to Doctors
                </button>

            </div>

        )

    }


    // Book appointment
    const bookAppointment = async () => {

        const token = localStorage.getItem('token')

        if (!token) {

            alert('Please login first')

            navigate('/login')

            return
        }


        if (!selectedDate) {

            alert('Please select an appointment date')

            return
        }


        if (!selectedTime) {

            alert('Please select an appointment time')

            return
        }


        try {

            const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/appointment/book`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                        token: token
                    },

                    body: JSON.stringify({

                        doctorId: doctor._id,

                        date: selectedDate,

                        time: selectedTime,

                        amount: doctor.fees

                    })
                }
            )


            const data = await response.json()


            if (data.success) {

                alert(data.message)

                navigate('/my-appointments')

            } else {

                alert(data.message)

            }

        } catch (error) {

            console.log(error)

            alert('Failed to book appointment')

        }

    }


    return (

        <div className='mt-10'>

            {/* Doctor Information */}

            <div className='flex flex-col sm:flex-row gap-8'>

                {/* Doctor Image */}

                <div>

                    <img
                        src={doctor.image}
                        alt={doctor.name}
                        className='w-full sm:max-w-72 rounded-lg bg-blue-50'
                    />

                </div>


                {/* Doctor Details */}

                <div className='flex-1 border border-gray-300 rounded-lg p-8'>

                    <h1 className='text-2xl font-semibold text-gray-800'>
                        {doctor.name}
                    </h1>


                    <div className='flex items-center gap-2 mt-2 text-gray-600'>

                        <p>
                            {doctor.degree}
                        </p>

                        <span>
                            •
                        </span>

                        <p>
                            {doctor.speciality}
                        </p>

                    </div>


                    <div className='flex items-center gap-2 mt-3 text-sm'>

                        <span className='border px-2 py-1 rounded'>
                            {doctor.experience}
                        </span>

                    </div>


                    <h2 className='text-lg font-semibold mt-5'>
                        About Doctor
                    </h2>


                    <p className='text-gray-600 mt-2 leading-7'>
                        {doctor.about}
                    </p>


                    <p className='text-gray-700 mt-4 font-medium'>
                        Consultation Fee: ₹{doctor.fees}
                    </p>

                </div>

            </div>


            {/* Appointment Slots */}

            <div className='mt-10'>

                <h2 className='text-xl font-semibold text-gray-800'>
                    Book Appointment
                </h2>


                <p className='text-gray-600 mt-2'>
                    Select a date and time slot for your appointment.
                </p>


                {/* Dates */}

                <div className='flex gap-3 mt-6 overflow-x-auto'>

                    {
                        [
                            '26 Sep 2026',
                            '27 Sep 2026',
                            '28 Sep 2026',
                            '29 Sep 2026',
                            '30 Sep 2026'
                        ].map((date, index) => (

                            <button
                                key={index}
                                onClick={() => setSelectedDate(date)}
                                className={`min-w-28 border border-gray-300 rounded-lg py-3 transition ${
                                    selectedDate === date
                                        ? 'bg-primary text-white'
                                        : 'hover:bg-primary hover:text-white'
                                }`}
                            >

                                <p className='text-sm'>
                                    {date}
                                </p>

                            </button>

                        ))
                    }

                </div>


                {/* Time Slots */}

                <div className='mt-8'>

                    <h3 className='font-medium text-gray-800'>
                        Available Time Slots
                    </h3>


                    <div className='flex flex-wrap gap-3 mt-4'>

                        {
                            [
                                '10:00 AM',
                                '11:00 AM',
                                '12:00 PM',
                                '02:00 PM',
                                '03:00 PM',
                                '04:00 PM'
                            ].map((time, index) => (

                                <button
                                    key={index}
                                    onClick={() => setSelectedTime(time)}
                                    className={`border border-gray-300 rounded-full px-5 py-2 text-sm transition ${
                                        selectedTime === time
                                            ? 'bg-primary text-white'
                                            : 'hover:bg-primary hover:text-white'
                                    }`}
                                >

                                    {time}

                                </button>

                            ))
                        }

                    </div>

                </div>


                {/* Selected Information */}

                {
                    selectedDate && selectedTime && (

                        <div className='mt-6 p-4 bg-gray-50 rounded-lg'>

                            <p className='text-gray-700'>
                                <span className='font-medium'>
                                    Selected Date:
                                </span>{' '}
                                {selectedDate}
                            </p>

                            <p className='text-gray-700 mt-1'>
                                <span className='font-medium'>
                                    Selected Time:
                                </span>{' '}
                                {selectedTime}
                            </p>

                        </div>

                    )
                }


                {/* Book Button */}

                <button
                    onClick={bookAppointment}
                    className='bg-primary text-white px-10 py-3 rounded-full mt-8 hover:opacity-90 transition'
                >
                    Book Appointment
                </button>

            </div>

        </div>

    )

}

export default Appointment