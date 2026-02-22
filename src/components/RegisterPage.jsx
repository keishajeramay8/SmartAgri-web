// src/pages/RegisterPage.jsx
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
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    lat: null,
    lon: null,
    password: "",
    confirmPassword: "",
    remember: false,
  });

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ===============================
     INPUT CHANGE HANDLER
  =============================== */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (name === "email") validateEmail(value);
    if (name === "password" || name === "confirmPassword")
      validatePassword({ ...formData, [name]: value });

    if (name === "address") {
      if (value) fetchAddressSuggestions(value);
      else {
        setSuggestions([]);
        setShowSuggestions(false);
        setAddressError("Please select a Philippine address");
      }
    }
  };

  const validateEmail = (emailValue = formData.email) => {
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(emailValue.trim())) setEmailError("Invalid email");
    else setEmailError("");
  };

  const validatePassword = (data = formData) => {
    if (data.confirmPassword && data.password !== data.confirmPassword) {
      setPasswordError("Passwords do not match");
    } else setPasswordError("");
  };

  /* ===============================
     GEOAPIFY ADDRESS AUTOCOMPLETE
  =============================== */
  const fetchAddressSuggestions = async (input) => {
    try {
      const res = await axios.get(
        "https://api.geoapify.com/v1/geocode/autocomplete",
        {
          params: {
            text: input,
            limit: 5,
            lang: "en",
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
      lat: place.properties.lat,
      lon: place.properties.lon,
    }));
    setAddressError("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  /* ===============================
     REGISTER WITH EMAIL / PASSWORD
  =============================== */
  const handleSubmit = async (e) => {
    e.preventDefault();
    validateEmail();
    validatePassword();

    if (
      emailError ||
      passwordError ||
      !formData.address ||
      !formData.lat ||
      !formData.lon
    ) {
      setAddressError(!formData.address ? "Please select a Philippine address" : "");
      return;
    }

    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email.trim(),
        address: formData.address,
        lat: formData.lat,
        lon: formData.lon,
        role: "admin",
        createdAt: serverTimestamp(),
      });

      navigate("/login");

    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        setEmailError("Email is already registered");
      } else alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     GOOGLE SIGN-IN (MATCH LOGIN PAGE)
  =============================== */
  const handleGoogleRegister = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Google Sign-In error:", error);
      alert("Google Registration failed! " + error.message);
    }
  };

  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result) {
          const user = result.user;
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              firstName: user.displayName?.split(" ")[0] || "",
              lastName: user.displayName?.split(" ")[1] || "",
              email: user.email,
              address: "",
              lat: null,
              lon: null,
              role: "admin",
              createdAt: serverTimestamp(),
            });
          }

          navigate("/dashboard");
        }
      })
      .catch((error) => console.error("Redirect result error:", error));
  }, [navigate]);

  /* =============================== */
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
            type="text"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            onBlur={() => validateEmail()}
            style={{ borderColor: emailError ? "red" : "#ccc" }}
            required
          />
          {emailError && <div className="inline-error">{emailError}</div>}

          <div style={{ position: "relative" }}>
            <input
              type="text"
              name="address"
              placeholder="Enter your address"
              value={formData.address}
              onChange={handleChange}
              style={{ borderColor: addressError ? "red" : "#ccc" }}
              autoComplete="off"
              required
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
          {addressError && <div className="inline-error">{addressError}</div>}

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
            required
          />
          {passwordError && <div className="inline-error">{passwordError}</div>}

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
            {loading ? "Registering..." : "REGISTER"}
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
            Already have an account? <Link to="/login">Sign in.</Link>
          </p>
        </form>
      </div>
    </section>
  );
}