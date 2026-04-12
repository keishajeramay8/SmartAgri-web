import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import landinglogo from "../assets/landinglogo.png";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      setLoading(false);
      alert("Invalid email or password!");
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          firstName: user.displayName?.split(" ")[0] || "",
          lastName: user.displayName?.split(" ")[1] || "",
          email: user.email,
          createdAt: serverTimestamp(),
        });
      }
      navigate("/dashboard");
    } catch (error) {
      console.error("Google Sign-In error:", error);
      alert("Google Sign-In failed!");
    }
  };

  return (
    <div>

      {/* ── NAVBAR ── */}
      <nav className="lp-nav">
        <div className="lp-nav__brand">
          <span className="lp-nav__brand-italic">Smart</span>
          <span className="lp-nav__brand-bold">AGRI</span>
        </div>
        <ul className="lp-nav__links">
          <li><button onClick={() => navigate('/')}>Home</button></li>
          <li>
            <button className="lp-nav__active-btn" onClick={() => navigate('/login')}>
              Login
            </button>
          </li>
          <li><button onClick={() => navigate('/register')}>Register</button></li>
        </ul>
      </nav>

      {/* ── PAGE ── */}
      <div className="login-page">

        {/* LEFT — Illustration */}
        <div className="left-side">
          <div className="logo-wrapper">
            <img src={landinglogo} alt="SmartAGRI" />
          </div>
        </div>

        {/* RIGHT — Form */}
        <div className="right-side">
          <form className="login-form" onSubmit={handleSubmit}>

            {/* Brand mark */}
            <span className="login-form-brand">
              <span className="login-form-brand-italic">Smart</span>AGRI
            </span>

            <h2>Welcome Back</h2>
            <p>Please login to continue</p>

            <input
              type="email"
              placeholder="Email address"
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

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>

            <div className="divider"><span>or</span></div>

            <button type="button" className="google-btn" onClick={handleGoogleSignIn}>
              Continue with Google
            </button>

            <div className="signin-link">
              Don't have an account? <Link to="/register">Register</Link>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}