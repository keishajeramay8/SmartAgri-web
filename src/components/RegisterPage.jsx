import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  sendEmailVerification,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { setDoc, doc, serverTimestamp, getDoc } from "firebase/firestore";
import axios from "axios";
import logo from "../assets/landinglogo.png";
import "./RegisterPage.css";

const GEOAPIFY_KEY = "ceea5600e9214d0cb5719308012683fd";

// ── Known disposable / fake email domains (no API key needed) ─────────────────
// Extend this list as needed.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","guerrillamail.net","guerrillamail.org",
  "guerrillamail.de","guerrillamail.info","guerrillamail.biz","spam4.me",
  "trashmail.com","trashmail.me","trashmail.net","trashmail.at","trashmail.io",
  "yopmail.com","yopmail.fr","cool.fr.nf","jetable.fr.nf","nospam.ze.tc",
  "nomail.xl.cx","mega.zik.dj","speed.1s.fr","courriel.fr.nf","moncourrier.fr.nf",
  "monemail.fr.nf","monmail.fr.nf","10minutemail.com","10minutemail.net",
  "10minutemail.org","10minutemail.de","10minutemail.info","10minutemail.co.uk",
  "throwam.com","throwam.net","dispostable.com","mailnull.com","spamgourmet.com",
  "spamgourmet.net","spamgourmet.org","sharklasers.com","guerrillamailblock.com",
  "grr.la","guerrillamail.info","spam4.me","maildrop.cc","filzmail.com",
  "fakeinbox.com","fakeinbox.net","mailnesia.com","spamspot.com","spamthisplease.com",
  "tempmail.com","tempmail.net","tempmail.org","temp-mail.org","temp-mail.de",
  "tempinbox.com","tempr.email","discard.email","discardmail.com","discardmail.de",
  "spamfree24.org","spamfree24.de","spamfree24.eu","spamfree24.info",
  "spamfree24.net","spamfree24.com","spam.la","spamoff.de","spamgob.com",
]);

// ── Layer 1: strict format check (any real email provider, not just Gmail) ────
const isValidEmailFormat = (email) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());

// ── Layer 2: disposable domain check ─────────────────────────────────────────
const isDisposableDomain = (email) => {
  const domain = email.trim().toLowerCase().split("@")[1] || "";
  return DISPOSABLE_DOMAINS.has(domain);
};

// ── Layer 3: MailCheck.ai — free, no API key, checks MX + disposable + typos ─
// Returns { valid, disposable, did_you_mean } or null on network error.
const checkWithMailCheckAI = async (email) => {
  try {
    const domain = email.trim().toLowerCase().split("@")[1];
    const res = await axios.get(
      `https://api.mailcheck.ai/domain/${encodeURIComponent(domain)}`,
      { timeout: 6000 }
    );
    // Response shape: { domain, mx, disposable, did_you_mean, ... }
    return res.data;
  } catch (err) {
    console.warn("MailCheck.ai error:", err);
    return null; // fail-open
  }
};

// ── Master email validation — runs all 3 layers ───────────────────────────────
// Returns an error string, or null if the email looks real.
const verifyEmail = async (email) => {
  const trimmed = email.trim();

  // Layer 1 — format
  if (!isValidEmailFormat(trimmed))
    return "Email does not exist.";

  // Layer 2 — local disposable blacklist (instant, no network)
  if (isDisposableDomain(trimmed))
    return "Disposable email addresses are not allowed.";

  // Layer 3 — MailCheck.ai (MX record + broader disposable DB + typo hint)
  const result = await checkWithMailCheckAI(trimmed);
  if (result) {
    if (result.disposable === true)
      return "Disposable email addresses are not allowed.";
    if (result.mx === false)
      return "Email does not exist.";
    // Offer a typo correction hint if the API spotted one
    if (result.did_you_mean)
      return `Did you mean ${result.did_you_mean}?`;
  }

  return null; // ✅ passes all checks
};

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

  const [emailError, setEmailError]       = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [addressError, setAddressError]   = useState("");
  const [suggestions, setSuggestions]     = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading]             = useState(false);

  // Verification-pending state
  const [verificationSent, setVerificationSent] = useState(false);
  const [pendingEmail, setPendingEmail]          = useState("");

  // Field change handler — clears errors only after user starts retyping
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear relevant error as user corrects the field
    if (name === "email") setEmailError("");
    if (name === "password" || name === "confirmPassword") setPasswordError("");

    if (name === "address") {
      if (value) fetchAddressSuggestions(value);
      else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  // Basic Gmail format check
  const isValidGmailFormat = (email) =>
    /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email.trim());

  // AbstractAPI: verify the email is real / deliverable
  // Returns an error string on failure, null on success.
  // On network/quota errors we fail-open so the user isn't blocked.
  const checkEmailDeliverability = async (email) => {
    try {
      const res = await axios.get(
        "https://emailvalidation.abstractapi.com/v1/",
        {
          params: { api_key: ABSTRACT_EMAIL_KEY, email: email.trim() },
          timeout: 8000,
        }
      );
      const { is_valid_format, is_mx_found, is_smtp_valid, deliverability } = res.data;

      if (!is_valid_format?.value)
        return "Email does not exist.";

      if (!is_mx_found?.value)
        return "Email does not exist.";

      if (is_smtp_valid?.value === false && deliverability === "UNDELIVERABLE")
        return "Email does not exist.";

      if (is_smtp_valid?.value === false && deliverability !== "DELIVERABLE")
        return "Email does not exist.";

      return null; // looks good
    } catch (err) {
      console.warn("Email validation API error:", err);
      return null; // fail-open on network/quota errors
    }
  };

  // Password rules — must pass ALL four
  const PASSWORD_RULES = [
    { id: "length",  label: "At least 8 characters",        test: (p) => p.length >= 8 },
    { id: "upper",   label: "One uppercase letter (A–Z)",   test: (p) => /[A-Z]/.test(p) },
    { id: "number",  label: "One number (0–9)",             test: (p) => /[0-9]/.test(p) },
    { id: "special", label: "One special character (!@#…)", test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p) },
  ];

  // Geoapify autocomplete
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

  // ── Submit — all validation runs HERE, nothing shown before this ────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Reset all errors first
    setEmailError("");
    setPasswordError("");
    setAddressError("");

    let hasError = false;

    // 1. Gmail format check
    if (!isValidGmailFormat(formData.email)) {
      setEmailError("Email does not exist.");
      hasError = true;
    }

    // 2. Password strength rules
    const failedRules = PASSWORD_RULES.filter((r) => !r.test(formData.password));
    if (failedRules.length > 0) {
      setPasswordError(
        "Password must include: " +
          failedRules.map((r) => r.label.toLowerCase()).join(", ") + "."
      );
      hasError = true;
    } else if (formData.password !== formData.confirmPassword) {
      setPasswordError("Passwords do not match.");
      hasError = true;
    }

    // 3. Address
    if (!formData.address || !formData.lat || !formData.lon) {
      setAddressError("Please select a Philippine address.");
      hasError = true;
    }

    // Stop here if any local validation failed
    if (hasError) return;

    // 4. Deliverability check (API call — only reached if format is valid)
    setLoading(true);
    const apiError = await checkEmailDeliverability(formData.email);
    if (apiError) {
      setEmailError(apiError);
      setLoading(false);
      return;
    }

    try {
      // 5. Create Firebase account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      );
      const user = userCredential.user;

      // 6. Save user data in Firestore
      await setDoc(doc(db, "users", user.uid), {
        firstName:     formData.firstName,
        lastName:      formData.lastName,
        email:         formData.email.trim(),
        address:       formData.address,
        lat:           formData.lat,
        lon:           formData.lon,
        role:          "admin",
        emailVerified: false,
        createdAt:     serverTimestamp(),
      });

      // 7. Send verification email
      await sendEmailVerification(user, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });

      // 8. Sign out immediately so they can't use the app unverified
      await auth.signOut();

      setPendingEmail(formData.email.trim());
      setVerificationSent(true);
    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use")
        setEmailError("Email is already registered.");
      else alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Google Register
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
          const user    = result.user;
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              firstName:     user.displayName?.split(" ")[0] || "",
              lastName:      user.displayName?.split(" ")[1] || "",
              email:         user.email,
              address:       "",
              lat:           null,
              lon:           null,
              role:          "admin",
              emailVerified: true,
              createdAt:     serverTimestamp(),
            });
          }
          navigate("/dashboard");
        }
      })
      .catch((error) => console.error("Redirect result error:", error));
  }, [navigate]);

  // Verification-pending screen
  if (verificationSent) {
    return (
      <div>
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

        <section className="register-page">
          <div className="left-side">
            <div className="logo-wrapper">
              <img src={logo} alt="SmartAGRI Logo" />
            </div>
          </div>

          <div className="right-side">
            <div className="register-form verification-box">
              <span className="register-form-brand">
                <span className="register-form-brand-italic">Smart</span>AGRI
              </span>

              <div className="verification-icon">📧</div>
              <h2>Verify Your Email</h2>
              <p>
                We sent a verification link to{" "}
                <strong>{pendingEmail}</strong>.
                <br />
                Please check your inbox (and spam folder), then click the link
                to activate your account.
              </p>
              <p className="verification-note">
                Once verified, you can{" "}
                <Link to="/login">sign in here</Link>.
              </p>

              <ResendVerification email={pendingEmail} password={formData.password} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Main registration form
  return (
    <div>
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

      <section className="register-page">
        <div className="left-side">
          <div className="logo-wrapper">
            <img src={logo} alt="SmartAGRI Logo" />
          </div>
        </div>

        <div className="right-side">
          <form className="register-form" onSubmit={handleSubmit} noValidate>
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
              autoComplete="given-name"
              required
            />
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleChange}
              autoComplete="family-name"
              required
            />

            {/* Email — no onBlur validation, no "Checking…" indicator */}
            <div style={{ position: "relative" }}>
              <input
                type="text"
                name="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                autoComplete="off"
                style={{ borderColor: emailError ? "red" : "" }}
                required
              />
            </div>
            {emailError && (
              <span className="inline-error">{emailError}</span>
            )}

            {/* Address */}
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
            {addressError && (
              <span className="inline-error">{addressError}</span>
            )}

            {/* Password — autoComplete="new-password" suppresses browser suggestions */}
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              style={{ borderColor: passwordError ? "red" : "" }}
              required
            />

            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              style={{ borderColor: passwordError ? "red" : "" }}
              required
            />
            {passwordError && (
              <span className="inline-error">{passwordError}</span>
            )}

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
              {loading ? "Registering…" : "Register"}
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

// Helper: Resend verification email
function ResendVerification({ email, password }) {
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [cooldown, setCooldown]   = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setResendMsg("");

    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      await auth.signOut();
      setResendMsg("Verification email resent! Check your inbox.");
      setCooldown(60);
    } catch (err) {
      console.error(err);
      setResendMsg(
        err.code === "auth/wrong-password"
          ? "Could not resend — please register again."
          : "Failed to resend. Please try again later."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="resend-container">
      <button
        type="button"
        className="register-btn resend-btn"
        onClick={handleResend}
        disabled={resending || cooldown > 0}
      >
        {resending
          ? "Sending…"
          : cooldown > 0
          ? `Resend in ${cooldown}s`
          : "Resend Verification Email"}
      </button>
      {resendMsg && <p className="resend-msg">{resendMsg}</p>}
    </div>
  );
}