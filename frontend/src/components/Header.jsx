import group_profiles from '../assets/assets_frontend/group_profiles.png';
import arrow_icon from '../assets/assets_frontend/arrow_icon.svg';
import header_img from '../assets/assets_frontend/header_img.png';
import { useNavigate } from 'react-router-dom';

const Header = () => {

  const navigate = useNavigate();

  return (
    <div className='flex flex-col md:flex-row bg-primary rounded-lg px-6 md:px-10 lg:px-14'>

      {/* Left Side */}
      <div className='md:w-1/2 flex flex-col items-start justify-center gap-4 py-10 m-auto md:py-[10vw] md:pb-[10vw]'>

        <p className='text-3xl md:text-4xl lg:text-5xl text-white font-semibold leading-tight'>
          Book Appointment <br />
          With Trusted Doctors
        </p>

        <div className='flex items-center gap-3 text-white text-sm font-light'>
          <img src={group_profiles} alt="" className='w-28' />

          <p>
            Simply browse through our extensive list of trusted doctors, <br />
            schedule your appointment hassle-free.
          </p>
        </div>

        <button
          onClick={() => navigate('/doctors')}
          className='flex items-center gap-2 bg-white px-8 py-3 rounded-full text-gray-600 text-sm m-auto md:m-0'
        >
          Book appointment
          <img src={arrow_icon} alt="" className='w-3' />
        </button>

      </div>

      {/* Right Side */}
      <div className='md:w-1/2 relative'>
        <img
          src={header_img}
          alt=""
          className='w-full md:absolute bottom-0 h-auto rounded-lg'
        />
      </div>

    </div>
  );
};

export default Header;