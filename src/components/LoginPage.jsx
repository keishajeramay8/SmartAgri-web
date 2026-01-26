import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import landinglogo from "../assets/landinglogo.png";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Optionally fetch the user's address from Realtime Database
      const userRef = ref(database, `users/${user.uid}/address`);
      const snapshot = await get(userRef);
      const address = snapshot.exists() ? snapshot.val() : null;
      console.log("User address:", address); // for later use (weather API)

      // Navigate to DashboardPage
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      alert("Invalid email or password!");
    }
  };

  return (
    <div className="login-page">
      {/* LEFT SIDE LOGO */}
      <div className="left-side">
        <div className="logo-wrapper">
          <img src={landinglogo} alt="Logo" />
        </div>
      </div>

      {/* RIGHT SIDE LOGIN FORM */}
      <div className="right-side">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2>Welcome Back</h2>
          <p>Please login to continue</p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="checkbox">
            <input type="checkbox" id="remember" />
            <label htmlFor="remember">Remember me</label>
          </div>

          <button type="submit" className="login-btn">
            Login
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <button type="button" className="google-btn">
            Continue with Google
          </button>

          <div className="signin-link">
            Don’t have an account? <a href="/register">Register</a>
          </div>
        </form>
      </div>
    </div>
  );
}
