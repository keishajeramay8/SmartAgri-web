import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, database } from "../firebase";
import axios from "axios";
import logo from "../assets/landinglogo.png";
import "./RegisterPage.css";

const GEOAPIFY_KEY = "2fa9194d85ee4a87a2b8de481d61ecb5";

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

  const handleChange = async (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });

    if (name === "address") {
      if (value) fetchAddressSuggestions(value);
      else {
        setSuggestions([]);
        setAddressError("Please select a Philippine address");
        setShowSuggestions(false);
      }
    }
  };

  const fetchAddressSuggestions = async (input) => {
    try {
      const res = await axios.get("https://api.geoapify.com/v1/geocode/autocomplete", {
        params: {
          text: input,
          limit: 5,
          lang: "en",
          country: "PH",
          apiKey: GEOAPIFY_KEY,
        },
      });
      setSuggestions(res.data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectAddress = (place) => {
    setFormData({
      ...formData,
      address: place.properties.formatted,
      lat: place.properties.lat,
      lon: place.properties.lon,
    });
    setAddressError("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const validateEmail = () => {
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(formData.email.trim())) setEmailError("Invalid email");
    else setEmailError("");
  };

  const validatePassword = () => {
    if (formData.confirmPassword && formData.password !== formData.confirmPassword)
      setPasswordError("Passwords do not match");
    else setPasswordError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (emailError || passwordError || !formData.address || !formData.lat || !formData.lon) {
      setAddressError(!formData.address ? "Please select a Philippine address" : "");
      return;
    }

    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      );

      const user = userCredential.user;

      await set(ref(database, "users/" + user.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email.trim(),
        address: formData.address,
        lat: formData.lat,
        lon: formData.lon,
      });

      navigate("/login");
    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") setEmailError("Email is already registered");
      else alert(error.message);
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
            type="text"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            onBlur={validateEmail}
            style={{ borderColor: emailError ? "red" : "#ccc" }}
            required
          />
          {emailError && <div className="inline-error">{emailError}</div>}

          <div className="autocomplete-wrapper" style={{ position: "relative" }}>
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
              <ul
                className="suggestions-list"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderTop: "none",
                  zIndex: 10,
                  maxHeight: "150px",
                  overflowY: "auto",
                  padding: 0,
                  margin: 0,
                  listStyle: "none",
                }}
              >
                {suggestions.map((item) => (
                  <li
                    key={item.properties.place_id}
                    onClick={() => handleSelectAddress(item)}
                    style={{
                      padding: "8px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eee",
                    }}
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
            onBlur={validatePassword}
            style={{ borderColor: passwordError ? "red" : "#ccc" }}
            required
          />

          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            onBlur={validatePassword}
            style={{ borderColor: passwordError ? "red" : "#ccc" }}
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

          <button
            type="submit"
            className="register-btn"
            disabled={!!emailError || !!passwordError || !!addressError}
          >
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
