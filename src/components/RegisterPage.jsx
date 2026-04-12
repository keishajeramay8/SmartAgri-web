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

export default function RegisterPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", address: "",
    lat: null, lon: null, password: "", confirmPassword: "", remember: false,
  });

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Only updates state, clears error as user corrects — no validation on keystroke ──
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

    // Clear errors as user starts correcting
    if (name === "email" && emailError) setEmailError("");
    if ((name === "password" || name === "confirmPassword") && passwordError) setPasswordError("");

    // Address autocomplete
    if (name === "address") {
      if (value) fetchAddressSuggestions(value);
      else {
        setSuggestions([]);
        setShowSuggestions(false);
        setAddressError("Please select a Philippine address");
      }
    }
  };

  // ── Validate only when user leaves the field (onBlur) ──
  const validateEmail = (emailValue = formData.email) => {
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(emailValue.trim())) setEmailError("Invalid email");
    else setEmailError("");
  };

  const validatePassword = (data = formData) => {
    if (data.confirmPassword && data.password !== data.confirmPassword)
      setPasswordError("Passwords do not match");
    else setPasswordError("");
  };

  const fetchAddressSuggestions = async (input) => {
    try {
      const res = await axios.get("https://api.geoapify.com/v1/geocode/autocomplete", {
        params: { text: input, limit: 5, lang: "en", country: "PH", apiKey: GEOAPIFY_KEY },
      });
      setSuggestions(res.data.features || []);
      setShowSuggestions(true);
    } catch (error) { console.error(error); }
  };

  const handleSelectAddress = (place) => {
    setFormData((prev) => ({
      ...prev,
      address: place.properties.formatted,
      lat: place.properties.lat,
      lon: place.properties.lon,
    }));
    setAddressError("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Run all validations on submit as a final check
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(formData.email.trim())) {
      setEmailError("Invalid email");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (!formData.address || !formData.lat || !formData.lon) {
      setAddressError("Please select a Philippine address");
      return;
    }
    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email.trim(), formData.password);
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        firstName: formData.firstName, lastName: formData.lastName,
        email: formData.email.trim(), address: formData.address,
        lat: formData.lat, lon: formData.lon, role: "admin", createdAt: serverTimestamp(),
      });
      navigate("/login");
    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") setEmailError("Email is already registered");
      else alert(error.message);
    } finally { setLoading(false); }
  };

  const handleGoogleRegister = async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithRedirect(auth, provider); }
    catch (error) { console.error("Google Sign-In error:", error); alert("Google Registration failed! " + error.message); }
  };

  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (result) {
        const user = result.user;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            firstName: user.displayName?.split(" ")[0] || "",
            lastName: user.displayName?.split(" ")[1] || "",
            email: user.email, address: "", lat: null, lon: null,
            role: "admin", createdAt: serverTimestamp(),
          });
        }
        navigate("/dashboard");
      }
    }).catch((error) => console.error("Redirect result error:", error));
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
          <li><button onClick={() => navigate('/')}>Home</button></li>
          <li><button onClick={() => navigate('/login')}>Login</button></li>
          <li>
            <button className="lp-nav__active-btn" onClick={() => navigate('/register')}>
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
          <form className="register-form" onSubmit={handleSubmit}>

            {/* Brand mark */}
            <span className="register-form-brand">
              <span className="register-form-brand-italic">Smart</span>AGRI
            </span>

            <h2>Create Account</h2>
            <p>Register your admin account below.</p>

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
              type="text"
              name="email"
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
              onBlur={() => validateEmail()}
              style={{ borderColor: emailError ? "red" : "" }}
              required
            />
            {emailError && <span className="inline-error">{emailError}</span>}

            <div style={{ position: "relative" }}>
              <input
                type="text"
                name="address"
                placeholder="Enter your address"
                value={formData.address}
                onChange={handleChange}
                style={{ borderColor: addressError ? "red" : "" }}
                autoComplete="off"
                required
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="suggestions-list">
                  {suggestions.map((item) => (
                    <li key={item.properties.place_id} onClick={() => handleSelectAddress(item)}>
                      {item.properties.formatted}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {addressError && <span className="inline-error">{addressError}</span>}

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              onBlur={() => validatePassword()}
              required
            />
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={() => validatePassword()}
              style={{ borderColor: passwordError ? "red" : "" }}
              required
            />
            {passwordError && <span className="inline-error">{passwordError}</span>}

            <label className="checkbox">
              <input
                type="checkbox"
                name="remember"
                checked={formData.remember}
                onChange={handleChange}
              />
              Remember me
            </label>

            <button type="submit" className="register-btn" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </button>

            <div className="divider"><span>or</span></div>

            <button type="button" className="google-btn" onClick={handleGoogleRegister}>
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