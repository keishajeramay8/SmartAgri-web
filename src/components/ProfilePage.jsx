import React, { useEffect, useState, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { auth, db, storage } from "../firebase";
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "./ProfilePage.css";

export default function ProfilePage() {
  const navigate = useNavigate();

  const [userName, setUserName]       = useState({ first: "", last: "" });
  const [email, setEmail]             = useState("");
  const [photoURL, setPhotoURL]       = useState(null);
  const [location, setLocation]       = useState({ lat: "", lon: "" });
  const [address, setAddress]         = useState("");

  const [editMode, setEditMode]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState("");

  const [form, setForm]               = useState({});
  const [photoFile, setPhotoFile]     = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [showPwSection, setShowPwSection] = useState(false);
  const [currentPw, setCurrentPw]     = useState("");
  const [newPw, setNewPw]             = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [pwMsg, setPwMsg]             = useState("");

  const [unreadCount, setUnreadCount] = useState(0);

  const fileInputRef = useRef(null);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Load user data
  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/login");

      setEmail(user.email || "");

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setUserName({ first: d.firstName || "", last: d.lastName || "" });
          setLocation({ lat: d.lat || "", lon: d.lon || "" });
          setAddress(d.address || "");
          setPhotoURL(d.photoURL || null);
          setForm({
            firstName: d.firstName || "",
            lastName:  d.lastName  || "",
            address:   d.address   || "",
            lat:       d.lat       || "",
            lon:       d.lon       || "",
          });
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchUser();
  }, []);

  // Realtime unread notifications
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.docs.filter((d) => !d.data().read).length);
    });
    return () => unsub();
  }, []);

  const getInitials = (first = "", last = "") =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  // Photo selection
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // Save profile
  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    setSaveMsg("");
    try {
      let newPhotoURL = photoURL;

      if (photoFile) {
        console.log("Uploading photo...", photoFile.name, photoFile.size);
        const storageRef = ref(storage, `profilePictures/${user.uid}`);
        const snapshot = await uploadBytes(storageRef, photoFile);
        console.log("Upload success:", snapshot);
        newPhotoURL = await getDownloadURL(storageRef);
        console.log("Download URL:", newPhotoURL);
        setPhotoURL(newPhotoURL);
      }

      await updateDoc(doc(db, "users", user.uid), {
        firstName: form.firstName,
        lastName:  form.lastName,
        address:   form.address,
        lat:       parseFloat(form.lat) || null,
        lon:       parseFloat(form.lon) || null,
        photoURL:  newPhotoURL || null,
      });

      setUserName({ first: form.firstName, last: form.lastName });
      setAddress(form.address);
      setLocation({ lat: form.lat, lon: form.lon });
      setPhotoFile(null);
      setPhotoPreview(null);
      setEditMode(false);
      setSaveMsg("Profile updated successfully.");
    } catch (err) {
      console.error("Full error:", err.code, err.message);
      setSaveMsg(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      firstName: userName.first,
      lastName:  userName.last,
      address,
      lat: location.lat,
      lon: location.lon,
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditMode(false);
    setSaveMsg("");
  };

  // Change password
  const handlePasswordChange = async () => {
    setPwMsg("");
    if (newPw !== confirmPw) { setPwMsg("Passwords do not match."); return; }
    if (newPw.length < 6)    { setPwMsg("Password must be at least 6 characters."); return; }

    const user = auth.currentUser;
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);
      setPwMsg("Password changed successfully.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setShowPwSection(false);
    } catch (err) {
      if (err.code === "auth/wrong-password") {
        setPwMsg("Current password is incorrect.");
      } else {
        setPwMsg("Failed to update password. Please try again.");
      }
    }
  };

  const navClass = ({ isActive }) => isActive ? "active" : undefined;
  const displayPhoto = photoPreview || photoURL;

  return (
    <div className="pf-dashboard">

      {/* ── SIDEBAR ── */}
      <aside className="pf-sidebar">
        <div className="pf-logo">
          <span className="pf-logo-smart">Smart</span>AGRI
        </div>

        <div className="pf-profile">
          <div className="pf-avatar">
            {displayPhoto
              ? <img src={displayPhoto} alt="avatar" className="pf-avatar-img" />
              : (userName.first ? getInitials(userName.first, userName.last) : "AD")}
          </div>
          <div>
            <p className="pf-profile-name">
              {userName.first ? `${userName.first} ${userName.last}` : "Loading..."}
            </p>
            <p className="pf-profile-role">Registered Admin</p>
          </div>
        </div>

        <nav className="pf-nav">
          <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
          <NavLink to="/register-farmer" className={navClass}>Register Farmer</NavLink>
          <NavLink to="/farmers" className={navClass}>Farmers</NavLink>
          <NavLink to="/notifications" className={navClass}>
            <span className="pf-notif-link">
              Notification
              {unreadCount > 0 && (
                <span className="pf-notif-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farm-group" className={navClass}>Farm Group</NavLink>
          <NavLink to="/profile" className={navClass}>Profile</NavLink>
        </nav>

        <button className="pf-logout" onClick={handleLogout}>Logout</button>
      </aside>

      {/* ── MAIN ── */}
      <main className="pf-main">

        <div className="pf-topbar">
          <div>
            <h1 className="pf-page-title">Profile</h1>
            <p className="pf-page-sub">Manage your account information</p>
          </div>
        </div>

        <div className="pf-content-grid">

          {/* LEFT — Avatar + quick info */}
          <div className="pf-left-col">
            <div className="pf-card pf-avatar-card">
              <div className="pf-big-avatar-wrap">
                {displayPhoto
                  ? <img src={displayPhoto} alt="Profile" className="pf-big-avatar-img" />
                  : <div className="pf-big-avatar-initials">
                      {userName.first ? getInitials(userName.first, userName.last) : "AD"}
                    </div>
                }
                {editMode && (
                  <button
                    className="pf-photo-change-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Change photo"
                  >
                    ✎
                  </button>
                )}
              </div>

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handlePhotoChange}
              />

              <p className="pf-big-name">
                {userName.first ? `${userName.first} ${userName.last}` : "Loading..."}
              </p>
              <p className="pf-big-role">Registered Admin</p>
              <p className="pf-big-email">{email}</p>

              {!editMode && (
                <button
                  className="pf-edit-btn"
                  onClick={() => { setEditMode(true); setSaveMsg(""); }}
                >
                  Edit Profile
                </button>
              )}
            </div>

            {/* Quick info */}
            <div className="pf-card pf-info-card">
              <p className="pf-info-label">Address</p>
              <p className="pf-info-val">{address || "—"}</p>
              <p className="pf-info-label" style={{ marginTop: 12 }}>Coordinates</p>
              <p className="pf-info-val">
                {location.lat && location.lon
                  ? `${location.lat}, ${location.lon}`
                  : "—"}
              </p>
            </div>
          </div>

          {/* RIGHT — Edit form */}
          <div className="pf-right-col">
            <div className="pf-card">
              <div className="pf-card-header">
                <h2 className="pf-card-title">Account Details</h2>
                {editMode && (
                  <span className="pf-editing-badge">Editing</span>
                )}
              </div>

              {saveMsg && (
                <div className={`pf-msg ${saveMsg.includes("success") ? "pf-msg--ok" : "pf-msg--err"}`}>
                  {saveMsg}
                </div>
              )}

              <div className="pf-form-grid">
                <div className="pf-field">
                  <label className="pf-field-label">First Name</label>
                  {editMode
                    ? <input
                        className="pf-input"
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      />
                    : <p className="pf-field-val">{userName.first || "—"}</p>
                  }
                </div>

                <div className="pf-field">
                  <label className="pf-field-label">Last Name</label>
                  {editMode
                    ? <input
                        className="pf-input"
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      />
                    : <p className="pf-field-val">{userName.last || "—"}</p>
                  }
                </div>

                <div className="pf-field pf-field--full">
                  <label className="pf-field-label">Email Address</label>
                  <p className="pf-field-val pf-field-val--muted">{email || "—"}</p>
                </div>

                <div className="pf-field pf-field--full">
                  <label className="pf-field-label">Address</label>
                  {editMode
                    ? <input
                        className="pf-input"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="City, Province"
                      />
                    : <p className="pf-field-val">{address || "—"}</p>
                  }
                </div>
              </div>

              {editMode && (
                <div className="pf-action-row">
                  <button
                    className="pf-save-btn"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button className="pf-cancel-btn" onClick={handleCancel}>
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Change Password */}
            <div className="pf-card">
              <div className="pf-card-header">
                <h2 className="pf-card-title">Security</h2>
                <button
                  className="pf-toggle-pw-btn"
                  onClick={() => { setShowPwSection(!showPwSection); setPwMsg(""); }}
                >
                  {showPwSection ? "Cancel" : "Change Password"}
                </button>
              </div>

              {!showPwSection && (
                <p className="pf-pw-hint">
                  Your password was last changed via Firebase Authentication.
                </p>
              )}

              {showPwSection && (
                <div className="pf-pw-form">
                  {pwMsg && (
                    <div className={`pf-msg ${pwMsg.includes("success") ? "pf-msg--ok" : "pf-msg--err"}`}>
                      {pwMsg}
                    </div>
                  )}
                  <div className="pf-field">
                    <label className="pf-field-label">Current Password</label>
                    <input
                      className="pf-input"
                      type="password"
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="pf-field">
                    <label className="pf-field-label">New Password</label>
                    <input
                      className="pf-input"
                      type="password"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="Min. 6 characters"
                    />
                  </div>
                  <div className="pf-field">
                    <label className="pf-field-label">Confirm New Password</label>
                    <input
                      className="pf-input"
                      type="password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Re-enter new password"
                    />
                  </div>
                  <div className="pf-action-row">
                    <button className="pf-save-btn" onClick={handlePasswordChange}>
                      Update Password
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}