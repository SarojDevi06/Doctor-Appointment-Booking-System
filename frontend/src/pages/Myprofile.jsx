import React, { useEffect, useState } from 'react'
import { assets } from '../assets/assets_frontend/assets'

const Myprofile = () => {

    const [isEdit, setIsEdit] = useState(false)

    const [userData, setUserData] = useState({
        name: 'Saroj Devi',
        image: assets.profile_pic,
        email: 'saroj@example.com',
        phone: '9876543210',
        address: {
            line1: 'Akal College of Engineering and Technology',
            line2: 'Baru Sahib, Himachal Pradesh'
        },
        gender: 'Female',
        dob: '2004-01-01'
    })

    useEffect(() => {
        const getProfile = async () => {
            try {
                const token = localStorage.getItem('token')

                const response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/user/profile`,
                    {
                        method: 'GET',
                        headers: {
                            token: token
                        }
                    }
                )

                const data = await response.json()

                if (data.success) {
                    setUserData(data.user)
                } else {
                    alert(data.message)
                }

            } catch (error) {
                console.log(error)
                alert('Failed to load profile')
            }
        }

        getProfile()
    }, [])


    const updateProfile = async () => {
        try {
            const token = localStorage.getItem('token')

            const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/user/update-profile`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        token: token
                    },
                    body: JSON.stringify({
                        name: userData.name,
                        phone: userData.phone,
                        address: userData.address,
                        gender: userData.gender,
                        dob: userData.dob
                    })
                }
            )

            const data = await response.json()

            if (data.success) {
                alert(data.message)
                setIsEdit(false)
            } else {
                alert(data.message)
            }

        } catch (error) {
            console.log(error)
            alert('Failed to update profile')
        }
    }


    return (

        <div className='max-w-2xl flex flex-col gap-4 text-sm mt-10'>

            {/* Profile Image */}

            <div>

                <img
                    className='w-36 rounded-lg'
                    src={userData.image}
                    alt='profile'
                />

            </div>


            {/* Name */}

            {
                isEdit

                    ? (
                        <input
                            className='bg-gray-50 text-2xl font-medium max-w-60 border rounded px-2 py-1'
                            type='text'
                            value={userData.name}
                            onChange={(e) =>
                                setUserData({
                                    ...userData,
                                    name: e.target.value
                                })
                            }
                        />
                    )

                    : (
                        <p className='font-medium text-2xl text-neutral-800'>
                            {userData.name}
                        </p>
                    )
            }


            <hr className='bg-zinc-400 h-[1px] border-none' />


            {/* Contact Information */}

            <div>

                <p className='text-gray-500 underline mt-3'>
                    CONTACT INFORMATION
                </p>

                <div className='grid grid-cols-[100px_1fr] gap-y-2 mt-3 text-gray-600'>

                    <p>Email id:</p>

                    <p className='text-blue-500'>
                        {userData.email}
                    </p>


                    <p>Phone:</p>

                    {
                        isEdit

                            ? (
                                <input
                                    className='bg-gray-50 border rounded px-2 py-1 max-w-60'
                                    type='text'
                                    value={userData.phone}
                                    onChange={(e) =>
                                        setUserData({
                                            ...userData,
                                            phone: e.target.value
                                        })
                                    }
                                />
                            )

                            : (
                                <p className='text-blue-500'>
                                    {userData.phone}
                                </p>
                            )
                    }


                    <p>Address:</p>

                    {
                        isEdit

                            ? (
                                <div className='flex flex-col gap-2 max-w-60'>

                                    <input
                                        className='bg-gray-50 border rounded px-2 py-1'
                                        type='text'
                                        value={userData.address.line1}
                                        onChange={(e) =>
                                            setUserData({
                                                ...userData,
                                                address: {
                                                    ...userData.address,
                                                    line1: e.target.value
                                                }
                                            })
                                        }
                                    />

                                    <input
                                        className='bg-gray-50 border rounded px-2 py-1'
                                        type='text'
                                        value={userData.address.line2}
                                        onChange={(e) =>
                                            setUserData({
                                                ...userData,
                                                address: {
                                                    ...userData.address,
                                                    line2: e.target.value
                                                }
                                            })
                                        }
                                    />

                                </div>
                            )

                            : (
                                <p>
                                    {userData.address.line1}
                                    <br />
                                    {userData.address.line2}
                                </p>
                            )
                    }

                </div>

            </div>


            {/* Basic Information */}

            <div>

                <p className='text-gray-500 underline mt-3'>
                    BASIC INFORMATION
                </p>

                <div className='grid grid-cols-[100px_1fr] gap-y-2 mt-3 text-gray-600'>

                    <p>Gender:</p>

                    {
                        isEdit

                            ? (
                                <select
                                    className='bg-gray-50 border rounded px-2 py-1 max-w-32'
                                    value={userData.gender}
                                    onChange={(e) =>
                                        setUserData({
                                            ...userData,
                                            gender: e.target.value
                                        })
                                    }
                                >
                                    <option value='Male'>
                                        Male
                                    </option>

                                    <option value='Female'>
                                        Female
                                    </option>

                                    <option value='Other'>
                                        Other
                                    </option>

                                </select>
                            )

                            : (
                                <p>
                                    {userData.gender}
                                </p>
                            )
                    }


                    <p>Date of Birth:</p>

                    {
                        isEdit

                            ? (
                                <input
                                    className='bg-gray-50 border rounded px-2 py-1 max-w-40'
                                    type='date'
                                    value={userData.dob}
                                    onChange={(e) =>
                                        setUserData({
                                            ...userData,
                                            dob: e.target.value
                                        })
                                    }
                                />
                            )

                            : (
                                <p>
                                    {userData.dob}
                                </p>
                            )
                    }

                </div>

            </div>


            {/* Edit / Save Button */}

            <div className='mt-5'>

                {
                    isEdit

                        ? (
                            <button
                                onClick={updateProfile}
                                className='border border-primary text-primary px-8 py-2 rounded-full hover:bg-primary hover:text-white transition'
                            >
                                Save Information
                            </button>
                        )

                        : (
                            <button
                                onClick={() => setIsEdit(true)}
                                className='border border-primary text-primary px-8 py-2 rounded-full hover:bg-primary hover:text-white transition'
                            >
                                Edit Profile
                            </button>
                        )
                }

            </div>

        </div>
    )
}

export default Myprofile