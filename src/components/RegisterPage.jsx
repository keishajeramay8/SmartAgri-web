import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { setDoc, doc, serverTimestamp, getDoc } from "firebase/firestore";
import axios from "axios";
import logo from "../assets/landinglogo.png";
import "./RegisterPage.css";

const GEOAPIFY_KEY = "ceea5600e9214d0cb5719308012683fd";

// ── Password rules ──────────────────────────────────────────────────
const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (pw) => pw.length >= 8,
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter (A–Z)",
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    id: "special",
    label: "At least one special character (!@#$%^&*...)",
    test: (pw) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw),
  },
];

const isPasswordValid = (pw) =>
  PASSWORD_RULES.every((rule) => rule.test(pw));

const getFailedRules = (pw) =>
  PASSWORD_RULES.filter((rule) => !rule.test(pw));

// ── Eye icons ────────────────────────────────────────────────────────
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

export default function RegisterPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName:       "",
    lastName:        "",
    email:           "",
    address:         "",
    lat:             null,
    lon:             null,
    password:        "",
    confirmPassword: "",
    remember:        false,
  });

  const [errors, setErrors]           = useState({});
  const [submitted, setSubmitted]     = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [showPassword, setShowPassword]               = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Input change — no validation, just update state ───────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;

    setFormData((prev) => ({ ...prev, [name]: newValue }));

    // If already submitted, clear individual error as user corrects
    if (submitted) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // Address autocomplete
    if (name === "address") {
      setFormData((prev) => ({
        ...prev,
        address: newValue,
        lat: null,
        lon: null,
      }));
      if (value) fetchAddressSuggestions(value);
      else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  // ── Run all validations, return errors object ─────────────────────
  const runValidation = (data) => {
    const errs = {};

    if (!data.firstName.trim()) errs.firstName = "First name is required.";
    if (!data.lastName.trim())  errs.lastName  = "Last name is required.";

    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!data.email.trim()) {
      errs.email = "Email is required.";
    } else if (!gmailRegex.test(data.email.trim())) {
      errs.email = "Please enter a valid Gmail address.";
    }

    if (!data.address || !data.lat || !data.lon) {
      errs.address = "Please select a Philippine address from the suggestions.";
    }

    if (!data.password) {
      errs.password = "Password is required.";
    } else if (!isPasswordValid(data.password)) {
      const failed = getFailedRules(data.password);
      errs.password = failed.map((r) => r.label).join(" • ");
    }

    if (!data.confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (
      data.password &&
      isPasswordValid(data.password) &&
      data.password !== data.confirmPassword
    ) {
      errs.confirmPassword = "Passwords do not match.";
    }

    return errs;
  };

  // ── Address autocomplete ──────────────────────────────────────────
  const fetchAddressSuggestions = async (input) => {
    try {
      const res = await axios.get(
        "https://api.geoapify.com/v1/geocode/autocomplete",
        {
          params: {
            text:   input,
            limit:  5,
            lang:   "en",
            country: "PH",
            apiKey: GEOAPIFY_KEY,
          },
        }
      );
      setSuggestions(res.data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectAddress = (place) => {
    setFormData((prev) => ({
      ...prev,
      address: place.properties.formatted,
      lat:     place.properties.lat,
      lon:     place.properties.lon,
    }));
    if (submitted) {
      setErrors((prev) => ({ ...prev, address: "" }));
    }
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    const errs = runValidation(formData);
    setErrors(errs);

    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      );
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        firstName: formData.firstName.trim(),
        lastName:  formData.lastName.trim(),
        email:     formData.email.trim(),
        address:   formData.address,
        lat:       formData.lat,
        lon:       formData.lon,
        role:      "admin",
        createdAt: serverTimestamp(),
      });
      navigate("/login");
    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        setErrors((prev) => ({
          ...prev,
          email: "This email is already registered.",
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          general: error.message,
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google register ───────────────────────────────────────────────
  const handleGoogleRegister = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Google Sign-In error:", error);
      setErrors((prev) => ({
        ...prev,
        general: "Google Registration failed: " + error.message,
      }));
    }
  };

  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result) {
          const user    = result.user;
          const userRef  = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              firstName: user.displayName?.split(" ")[0] || "",
              lastName:  user.displayName?.split(" ")[1] || "",
              email:     user.email,
              address:   "",
              lat:       null,
              lon:       null,
              role:      "admin",
              createdAt: serverTimestamp(),
            });
          }
          navigate("/dashboard");
        }
      })
      .catch((error) => console.error("Redirect result error:", error));
  }, [navigate]);

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
          <li><button onClick={() => navigate("/login")}>Login</button></li>
          <li>
            <button
              className="lp-nav__active-btn"
              onClick={() => navigate("/register")}
            >
              Register
            </button>
          </li>
        </ul>
      </nav>

      {/* ── PAGE ── */}
      <section className="register-page">

        {/* LEFT — Illustration */}
        <div className="left-side">
          <div className="logo-wrapper">
            <img src={logo} alt="SmartAGRI Logo" />
          </div>
        </div>

        {/* RIGHT — Form */}
        <div className="right-side">
          <form className="register-form" onSubmit={handleSubmit} noValidate>

            <span className="register-form-brand">
              <span className="register-form-brand-italic">Smart</span>AGRI
            </span>

            <h2>Create Account</h2>
            <p>Register your admin account below.</p>

            {/* General error */}
            {errors.general && (
              <div className="reg-error-banner">{errors.general}</div>
            )}

            {/* First Name */}
            <input
              type="text"
              name="firstName"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleChange}
              className={errors.firstName ? "input-error" : ""}
            />
            {errors.firstName && (
              <span className="inline-error">{errors.firstName}</span>
            )}

            {/* Last Name */}
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleChange}
              className={errors.lastName ? "input-error" : ""}
            />
            {errors.lastName && (
              <span className="inline-error">{errors.lastName}</span>
            )}

            {/* Email */}
            <input
              type="text"
              name="email"
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? "input-error" : ""}
            />
            {errors.email && (
              <span className="inline-error">{errors.email}</span>
            )}

            {/* Address */}
            <div style={{ position: "relative" }}>
              <input
                type="text"
                name="address"
                placeholder="Enter your address"
                value={formData.address}
                onChange={handleChange}
                className={errors.address ? "input-error" : ""}
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="suggestions-list">
                  {suggestions.map((item) => (
                    <li
                      key={item.properties.place_id}
                      onClick={() => handleSelectAddress(item)}
                    >
                      {item.properties.formatted}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {errors.address && (
              <span className="inline-error">{errors.address}</span>
            )}

            {/* Password */}
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? "input-error" : ""}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && (
              <span className="inline-error">{errors.password}</span>
            )}

            {/* Confirm Password */}
            <div className="password-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? "input-error" : ""}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowConfirmPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="inline-error">{errors.confirmPassword}</span>
            )}

            {/* Remember me */}
            <label className="checkbox">
              <input
                type="checkbox"
                name="remember"
                checked={formData.remember}
                onChange={handleChange}
              />
              Remember me
            </label>

            <button
              type="submit"
              className="register-btn"
              disabled={loading}
            >
              {loading ? "Registering..." : "Register"}
            </button>

            <div className="divider"><span>or</span></div>

            <button
              type="button"
              className="google-btn"
              onClick={handleGoogleRegister}
            >
              Continue with Google
            </button>

            <p className="signin-link">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>

          </form>
        </div>
      </section>
    </div>
  );
}