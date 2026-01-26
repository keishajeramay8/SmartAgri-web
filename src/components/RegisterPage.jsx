import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, database } from "../firebase";
import logo from "../assets/landinglogo.png";
import "./RegisterPage.css";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    password: "",
    confirmPassword: "",
    remember: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (!formData.address) {
      alert("Please enter your address!");
      return;
    }

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      // Save user info in Realtime Database
      await set(ref(database, "users/" + user.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        address: formData.address, // store the address
      });

      // Navigate directly to DashboardPage
      navigate("/login"); 
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <section className="register-page">
      <div className="left-side">
        <div className="logo-wrapper">
          <img src={logo} alt="SmartAGRI Logo" />
        </div>
      </div>

      <div className="right-side">
        <form className="register-form" onSubmit={handleSubmit}>
          <h2>REGISTER</h2>
          <p>Register your account here.</p>

          <input
            type="text"
            name="firstName"
            placeholder="First Name"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="lastName"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="address"
            placeholder="Enter your address"
            value={formData.address}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />

          <label className="checkbox">
            <input
              type="checkbox"
              name="remember"
              checked={formData.remember}
              onChange={handleChange}
            />
            Remember me
          </label>

          <button type="submit" className="register-btn">
            REGISTER
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <button type="button" className="google-btn">
            Continue with Google
          </button>

          <p className="signin-link">
            Already have an account? <Link to="/login">Sign in.</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
