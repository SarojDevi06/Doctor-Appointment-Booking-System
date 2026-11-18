import React, { useEffect, useState } from 'react'
import { assets } from '../assets/assets_frontend/assets'

const Myappointments = () => {

    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)

    // Fetch user's appointments
    const getAppointments = async () => {
        try {

            const token = localStorage.getItem('token')

            if (!token) {
                setLoading(false)
                return
            }

            const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/appointment/my-appointments`,
                {
                    method: 'GET',
                    headers: {
                        token: token
                    }
                }
            )

            const data = await response.json()

            if (data.success) {
                setAppointments(data.appointments)
            } else {
                alert(data.message)
            }

        } catch (error) {
            console.log(error)
            alert('Failed to load appointments')
        } finally {
            setLoading(false)
        }
    }


    // Run when page opens
    useEffect(() => {
        getAppointments()
    }, [])


    // Cancel appointment
    const cancelAppointment = async (appointmentId) => {

        const confirmCancel = window.confirm(
            'Are you sure you want to cancel this appointment?'
        )

        if (!confirmCancel) return

        try {

            const token = localStorage.getItem('token')

            const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/appointment/cancel`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        token: token
                    },
                    body: JSON.stringify({
                        appointmentId: appointmentId
                    })
                }
            )

            const data = await response.json()

            if (data.success) {

                alert(data.message)

                // Reload appointments
                getAppointments()

            } else {
                alert(data.message)
            }

        } catch (error) {
            console.log(error)
            alert('Failed to cancel appointment')
        }
    }


    // Loading
    if (loading) {
        return (
            <div className='flex justify-center items-center py-20'>
                <p className='text-gray-600'>
                    Loading appointments...
                </p>
            </div>
        )
    }


    return (
        <div className='mt-10'>

            <p className='pb-3 mt-12 font-medium text-zinc-700 border-b'>
                MY APPOINTMENTS
            </p>


            <div className='mt-5'>

                {appointments.length === 0 ? (

                    <div className='text-center py-16'>

                        <p className='text-gray-500'>
                            You have no appointments.
                        </p>

                    </div>

                ) : (

                    appointments.map((appointment) => {

                        const doctor = appointment.doctorId

                        if (!doctor) return null

                        return (

                            <div
                                key={appointment._id}
                                className='grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-4 sm:gap-6 py-6 border-b'
                            >

                                {/* Doctor information */}
                                <div className='flex items-center gap-4'>

                                    <img
                                        src={
                                            doctor.image ||
                                            assets.profile_pic
                                        }
                                        alt={doctor.name}
                                        className='w-28 h-28 object-cover bg-blue-50 rounded-lg'
                                    />

                                    <div>

                                        <p className='text-gray-800 font-medium text-lg'>
                                            {doctor.name}
                                        </p>

                                        <p className='text-gray-600 text-sm'>
                                            {doctor.speciality}
                                        </p>

                                        <p
                                            className={
                                                appointment.status === 'Cancelled'
                                                    ? 'text-red-500 text-sm mt-2'
                                                    : 'text-green-600 text-sm mt-2'
                                            }
                                        >
                                            {appointment.status}
                                        </p>

                                    </div>

                                </div>


                                {/* Appointment details */}
                                <div className='flex flex-col justify-center'>

                                    <p className='text-gray-600 text-sm'>
                                        Appointment Date
                                    </p>

                                    <p className='text-gray-800 font-medium'>
                                        {appointment.date}
                                    </p>


                                    <p className='text-gray-600 text-sm mt-2'>
                                        Appointment Time
                                    </p>

                                    <p className='text-gray-800 font-medium'>
                                        {appointment.time}
                                    </p>


                                    {/* Cancel button */}
                                    {appointment.status !== 'Cancelled' && (

                                        <button
                                            onClick={() =>
                                                cancelAppointment(
                                                    appointment._id
                                                )
                                            }
                                            className='border border-red-400 text-red-500 rounded-lg px-5 py-2 mt-4 w-fit hover:bg-red-500 hover:text-white transition'
                                        >
                                            Cancel Appointment
                                        </button>

                                    )}

                                </div>

                            </div>

                        )

                    })

                )}

            </div>

        </div>
    )
}

export default Myappointments