import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import landinglogo from '../assets/landinglogo.png';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleGetStarted = () => navigate('/login');

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <div>

      {/* ── NAVBAR ── */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav--scrolled' : ''}`}>
        <div className="lp-nav__brand">
          <span className="lp-nav__brand-italic">Smart</span>
          <span className="lp-nav__brand-bold">AGRI</span>
        </div>
        <ul className={`lp-nav__links ${menuOpen ? 'lp-nav__links--open' : ''}`}>
          <li><button onClick={() => scrollTo('home')}>Home</button></li>
          <li><button onClick={() => scrollTo('about')}>About</button></li>
          <li><button onClick={() => scrollTo('features')}>Features</button></li>
          <li>
            <button className="lp-nav__login-btn" onClick={handleGetStarted}>Login</button>
          </li>
        </ul>
        <button
          className={`lp-nav__burger ${menuOpen ? 'lp-nav__burger--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="landing-section" id="home">
        <div className="wrapper">
          <div className="image-area">
            <img src={landinglogo} alt="SmartAGRI Illustration" />
          </div>
          <div className="text-area">
            <h1>
              WELCOME TO<br />
              <span className="brand">
                <span className="italic">Smart</span>
                <span className="bold">AGRI</span>
              </span>
            </h1>
            <p>Let's plant the seeds of progress together.</p>
            <button onClick={handleGetStarted}>GET STARTED</button>
          </div>
        </div>
      </section>

      {/* ── DIVIDER STRIP ── */}
      <div className="lp-divider">
        <span>IoT Soil Sensors</span>
        <span className="lp-divider-dot" />
        <span>Automated Irrigation</span>
        <span className="lp-divider-dot" />
        <span>Real-Time Alerts</span>
        <span className="lp-divider-dot" />
        <span>Water Analytics</span>
        <span className="lp-divider-dot" />
        <span>Multi-Farm Management</span>
      </div>

      {/* ── ABOUT ── */}
      <section className="lp-about" id="about">
        <span className="lp-tag">About SmartAGRI</span>
        <h2>Intelligent Farming, <span className="lp-gold">Simplified.</span></h2>
        <p>
          <strong>SmartAGRI</strong> SMARTAGRI is a soil moisture-based watering system 
          designed for chrysanthemum flowers. It uses IoT sensors to monitor soil conditions
           in real time and automate irrigation—ensuring optimal growth with no guesswork
            and no water waste.
        </p>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-features" id="features">
        <span className="lp-tag">What It Does</span>
        <h2>Everything Your Farm Needs</h2>
        <div className="lp-grid">
          {[
            { icon: '📡', title: 'Live Soil Monitoring', desc: 'ESP32 sensors stream soil readings every second to your dashboard.' },
            { icon: '🤖', title: 'Automated Irrigation', desc: 'Pump activates automatically based on soil moisture thresholds. Can also manually initiate irrigation.' },
            { icon: '🌧️', title: 'Rain Detection', desc: 'Weather scoring prevents over-watering before storms.' },
            { icon: '🔔', title: 'Instant Alerts', desc: 'Push notifications when soil status or pump state changes.' },
            { icon: '👥', title: 'Multi-Farm Management', desc: 'Manage multiple farms groups and devices from one dashboard.' },
            { icon: '📊', title: 'Water Analytics', desc: 'Track daily, weekly, and monthly water usage easily.' },
          ].map((f, i) => (
            <div className="lp-card" key={i}>
              <span className="lp-card-icon">{f.icon}</span>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer__brand">
          <span className="lp-nav__brand-italic">Smart</span>
          <span className="lp-nav__brand-bold">AGRI</span>
        </div>
        <p>© {new Date().getFullYear()} SmartAGRI. Precision Agriculture for the Modern Farmer.</p>
      </footer>

    </div>
  );
}