import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { specialityData } from '../assets/assets_frontend/assets'

const Doctors = () => {

    const navigate = useNavigate()

    const [selectedSpeciality, setSelectedSpeciality] = useState('')

    const [doctors, setDoctors] = useState([])

    useEffect(() => {
        const getDoctors = async () => {
            try {
                const response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/doctor/list`
                )

                const data = await response.json()

                if (data.success) {
                    setDoctors(data.doctors)
                } else {
                    alert(data.message)
                }

            } catch (error) {
                console.log(error)
                alert('Failed to load doctors')
            }
        }

        getDoctors()
    }, [])

    const filteredDoctors = selectedSpeciality
    ? doctors.filter(
        doctor =>
            doctor.speciality.trim().toLowerCase() ===
            selectedSpeciality.trim().toLowerCase()
      )
    : doctors

    return (

        <div>

            {/* Heading */}
            <p className='text-gray-600'>
                Browse through the doctors specialist.
            </p>


            {/* Specialities */}
            <div className='flex flex-col sm:flex-row items-start gap-5 mt-5'>

                <div className='flex flex-wrap gap-3'>

                    <button
                        onClick={() => setSelectedSpeciality('')}
                        className={`px-4 py-2 rounded-full border ${selectedSpeciality === ''
                                ? 'bg-primary text-white'
                                : 'bg-white text-gray-600'
                            }`}
                    >
                        All
                    </button>

                    {
                        specialityData.map((item, index) => (

                            <button
                                key={index}
                                onClick={() =>
                                    setSelectedSpeciality(item.speciality)
                                }
                                className={`px-4 py-2 rounded-full border ${selectedSpeciality === item.speciality
                                        ? 'bg-primary text-white'
                                        : 'bg-white text-gray-600'
                                    }`}
                            >
                                {item.speciality}
                            </button>

                        ))
                    }

                </div>

            </div>


            {/* Doctors */}
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-8'>

                {
                    filteredDoctors.map((doctor) => (

                        <div
                            key={doctor._id}
                            onClick={() =>
                                navigate(`/appointment/${doctor._id}`)
                            }
                            className='border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:-translate-y-1 transition-all duration-300'
                        >

                            <img
                                src={doctor.image}
                                alt={doctor.name}
                                className='w-full bg-blue-50'
                            />

                            <div className='p-4'>

                                <div className='flex items-center gap-2 text-sm text-green-500'>

                                    <span className='w-2 h-2 bg-green-500 rounded-full'></span>

                                    Available

                                </div>

                                <p className='text-gray-900 text-lg font-medium mt-1'>
                                    {doctor.name}
                                </p>

                                <p className='text-gray-600 text-sm'>
                                    {doctor.speciality}
                                </p>

                            </div>

                        </div>

                    ))
                }

            </div>

        </div>
    )
}

export default Doctors