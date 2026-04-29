import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import landinglogo from "../assets/landinglogo.png";
import "./LoginPage.css";

// Single toggle icon:
// visible=false → closed/slashed eye = password is hidden, click to show
// visible=true  → open eye           = password is visible, click to hide
const PasswordToggleIcon = ({ visible }) => {
  if (visible) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [googleError, setGoogleError] = useState("");

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      setLoading(false);
      switch (error.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setLoginError("Invalid email or password. Please try again.");
          break;
        case "auth/invalid-email":
          setLoginError("Please enter a valid email address.");
          break;
        case "auth/too-many-requests":
          setLoginError("Too many failed attempts. Please try again later.");
          break;
        case "auth/user-disabled":
          setLoginError("This account has been disabled. Please contact support.");
          break;
        default:
          setLoginError("Something went wrong. Please try again.");
      }
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
          lastName:  user.displayName?.split(" ")[1] || "",
          email:     user.email,
          createdAt: serverTimestamp(),
        });
      }
      navigate("/dashboard");
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setGoogleError("Google Sign-In failed. Please try again.");
    }
  };

  const openForgotModal = () => {
    setResetEmail("");
    setResetMessage("");
    setResetError("");
    setShowForgotModal(true);
  };

  const closeForgotModal = () => setShowForgotModal(false);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage("");
    setResetError("");
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage("Password reset email sent! Please check your inbox (and spam folder).");
    } catch (error) {
      console.error("Password reset error:", error);
      switch (error.code) {
        case "auth/user-not-found":
          setResetError("No account found with that email address.");
          break;
        case "auth/invalid-email":
          setResetError("Please enter a valid email address.");
          break;
        case "auth/too-many-requests":
          setResetError("Too many attempts. Please try again later.");
          break;
        default:
          setResetError("Something went wrong. Please try again.");
      }
    } finally {
      setResetLoading(false);
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
          <li><button onClick={() => navigate("/")}>Home</button></li>
          <li>
            <button className="lp-nav__active-btn" onClick={() => navigate("/login")}>
              Login
            </button>
          </li>
          <li><button onClick={() => navigate("/register")}>Register</button></li>
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

            <span className="login-form-brand">
              <span className="login-form-brand-italic">Smart</span>AGRI
            </span>

            <h2>Welcome Back</h2>
            <p>Please login to continue</p>

            {/* ── Email ── */}
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {/* ── Password ── */}
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <PasswordToggleIcon visible={showPassword} />
              </button>
            </div>

            <div className="checkbox">
              <input type="checkbox" id="remember" />
              <label htmlFor="remember">Remember me</label>
            </div>

            <div className="forgot-password-link">
              <a href="#forgot" onClick={(e) => { e.preventDefault(); openForgotModal(); }}>
                Forgot password?
              </a>
            </div>

            {loginError && <div className="login-error">{loginError}</div>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>

            <div className="divider"><span>or</span></div>

            <button type="button" className="google-btn" onClick={handleGoogleSignIn}>
              Continue with Google
            </button>

            {googleError && <div className="login-error">{googleError}</div>}

            <div className="signin-link">
              Don't have an account? <Link to="/register">Register</Link>
            </div>

          </form>
        </div>
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {showForgotModal && (
        <div className="modal-overlay" onClick={closeForgotModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeForgotModal}>&times;</button>
            <h3>Reset Password</h3>
            <p>Enter your email address and we'll send you a link to reset your password.</p>

            {resetMessage && <div className="reset-success">{resetMessage}</div>}
            {resetError   && <div className="reset-error">{resetError}</div>}

            {!resetMessage && (
              <form onSubmit={handlePasswordReset}>
                <input
                  type="email"
                  placeholder="Email address"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
                <button type="submit" className="login-btn" disabled={resetLoading}>
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            )}

            {resetMessage && (
              <button className="login-btn" onClick={closeForgotModal}>
                Back to Login
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}