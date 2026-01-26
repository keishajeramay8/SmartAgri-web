// LandingPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ import useNavigate
import landinglogo from '../assets/landinglogo.png';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate(); // ✅ initialize navigate

  const handleGetStarted = () => {
    navigate('/login'); // ✅ redirect to LoginPage
  };

  return (
    <section className="landing-section">
      <div className="wrapper">

        {/* LEFT IMAGE AREA */}
        <div className="image-area">
          <img src={landinglogo} alt="SmartAGRI Illustration" />
        </div>

        {/* RIGHT TEXT AREA */}
        <div className="text-area">
          <h1>
            WELCOME TO<br />
            <span className="brand">
              <span className="italic">Smart</span>
              <span className="bold">AGRI</span>
            </span>
          </h1>

          <p>Let’s plant the seeds of progress together.</p>

          <button onClick={handleGetStarted}>GET STARTED</button>
        </div>

      </div>
    </section>
  );
}
