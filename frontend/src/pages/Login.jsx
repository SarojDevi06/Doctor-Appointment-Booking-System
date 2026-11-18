import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const Login = () => {

    const navigate = useNavigate()

    const [state, setState] = useState('Sign Up')

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const onSubmitHandler = async (event) => {
        event.preventDefault()

        try {

            const url =
                state === 'Sign Up'
                    ? `${import.meta.env.VITE_BACKEND_URL}/api/user/register`
                    : `${import.meta.env.VITE_BACKEND_URL}/api/user/login`

            const body =
                state === 'Sign Up'
                    ? {
                        name,
                        email,
                        password
                    }
                    : {
                        email,
                        password
                    }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            })

            const data = await response.json()

            if (data.success) {

                // =========================
                // LOGIN SUCCESS
                // =========================

                if (state === 'Login') {

                    // JWT token save
                    localStorage.setItem('token', data.token)

                    // Navbar ko immediately update karne ke liye
                    window.dispatchEvent(
                        new Event('authChange')
                    )

                    alert('Login successful')

                    // Login ke baad home page
                    navigate('/')

                }

                // =========================
                // SIGN UP SUCCESS
                // =========================

                else {

                    alert('Account created successfully. Please login.')

                    // Form clear
                    setName('')
                    setEmail('')
                    setPassword('')

                    // Automatically Login mode par
                    setState('Login')
                }

            } else {

                // Backend ka actual error message
                alert(data.message)

            }

        } catch (error) {

            console.log(error)

            alert('Something went wrong. Please try again.')

        }
    }

    return (

        <form
            onSubmit={onSubmitHandler}
            className='min-h-[80vh] flex items-center justify-center'
        >

            <div className='flex flex-col gap-4 w-full max-w-md p-8 border border-gray-300 rounded-xl shadow-sm'>

                {/* Heading */}

                <div>

                    <h1 className='text-2xl font-semibold text-gray-800'>

                        {state === 'Sign Up'
                            ? 'Create Account'
                            : 'Login'}

                    </h1>

                    <p className='text-gray-600 text-sm mt-1'>

                        {state === 'Sign Up'
                            ? 'Please create an account to book appointments.'
                            : 'Please login to continue.'}

                    </p>

                </div>


                {/* Full Name */}

                {
                    state === 'Sign Up' && (

                        <div>

                            <label className='text-sm text-gray-700'>
                                Full Name
                            </label>

                            <input
                                type='text'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder='Enter your name'
                                pattern='[A-Za-z ]{3,50}'
                                title='Name should contain only letters and spaces (minimum 3 characters)'
                                className='w-full border border-gray-300 rounded-lg px-4 py-3 mt-1 outline-none focus:border-primary'
                                required
                            />

                        </div>

                    )
                }


                {/* Email */}

                <div>

                    <label className='text-sm text-gray-700'>
                        Email
                    </label>

                    <input
                        type='email'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder='Enter your email'
                        title='Please enter a valid email address'
                        className='w-full border border-gray-300 rounded-lg px-4 py-3 mt-1 outline-none focus:border-primary'
                        required
                    />

                </div>


                {/* Password */}

                <div>

                    <label className='text-sm text-gray-700'>
                        Password
                    </label>

                    <input
                        type='password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder='Enter your password'
                        minLength={6}
                        title='Password must be at least 6 characters'
                        className='w-full border border-gray-300 rounded-lg px-4 py-3 mt-1 outline-none focus:border-primary'
                        required
                    />

                </div>


                {/* Button */}

                <button
                    type='submit'
                    className='bg-primary text-white rounded-lg py-3 mt-2 hover:opacity-90'
                >

                    {state === 'Sign Up'
                        ? 'Create Account'
                        : 'Login'}

                </button>


                {/* Switch */}

                <p className='text-sm text-gray-600 text-center'>

                    {
                        state === 'Sign Up'
                            ? 'Already have an account?'
                            : "Don't have an account?"
                    }

                    <span
                        onClick={() =>
                            setState(
                                state === 'Sign Up'
                                    ? 'Login'
                                    : 'Sign Up'
                            )
                        }
                        className='text-primary font-medium cursor-pointer ml-1'
                    >

                        {
                            state === 'Sign Up'
                                ? 'Login'
                                : 'Create Account'
                        }

                    </span>

                </p>

            </div>

        </form>
    )
}

export default Login