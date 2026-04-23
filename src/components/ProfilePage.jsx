import React, { useEffect, useState, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { auth, db, storage } from "../firebase";
import {
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  getDocs,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import "./ProfilePage.css";

export default function ProfilePage() {
  const navigate = useNavigate();

  const [userName, setUserName]             = useState({ first: "", last: "" });
  const [email, setEmail]                   = useState("");
  const [photoURL, setPhotoURL]             = useState(null);
  const [location, setLocation]             = useState({ lat: "", lon: "" });
  const [address, setAddress]               = useState("");

  const [editMode, setEditMode]             = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saveMsg, setSaveMsg]               = useState("");

  const [form, setForm]                     = useState({});
  const [photoFile, setPhotoFile]           = useState(null);
  const [photoPreview, setPhotoPreview]     = useState(null);

  const [showPwSection, setShowPwSection]   = useState(false);
  const [currentPw, setCurrentPw]           = useState("");
  const [newPw, setNewPw]                   = useState("");
  const [confirmPw, setConfirmPw]           = useState("");
  const [pwMsg, setPwMsg]                   = useState("");

  const [unreadCount, setUnreadCount]       = useState(0);
  const [pendingCount, setPendingCount]     = useState(0); // ← NEW

  const fileInputRef = useRef(null);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // ── Load user data ──────────────────────────────────────────────
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
        console.error("Failed to load user:", err);
      }
    };
    fetchUser();
  }, []);

  // ── Realtime unread notifications ───────────────────────────────
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

  // ── Realtime Pending Farmer Requests ────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    let unsubscribers = [];

    const setupListeners = async () => {
      try {
        const groupQuery = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );
        const groupSnapshot = await getDocs(groupQuery);
        const countMap = {};

        groupSnapshot.docs.forEach((groupDoc) => {
          const groupId = groupDoc.id;
          countMap[groupId] = 0;
          const joinRef = collection(db, "farmgroups", groupId, "joinRequests");
          const unsub = onSnapshot(joinRef, (snap) => {
            countMap[groupId] = snap.size;
            const total = Object.values(countMap).reduce((a, b) => a + b, 0);
            setPendingCount(total);
          });
          unsubscribers.push(unsub);
        });
      } catch (err) {
        console.error("Error setting up pending count listeners:", err);
      }
    };

    setupListeners();
    return () => unsubscribers.forEach((fn) => fn());
  }, []);

  const getInitials = (first = "", last = "") =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  // ── Photo selection ─────────────────────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSaveMsg("❌ Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveMsg("❌ Image must be smaller than 5MB.");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setSaveMsg("");
  };

  // ── Upload photo ────────────────────────────────────────────────
  const uploadPhoto = (user, file) => {
    return new Promise((resolve, reject) => {
      const filePath   = `profilePictures/${user.uid}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const pct = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setUploadProgress(pct);
        },
        (error) => {
          const msgs = {
            "storage/unauthorized":         "Permission denied. Check Firebase Storage rules.",
            "storage/canceled":             "Upload was cancelled.",
            "storage/unknown":              "An unknown error occurred during upload.",
            "storage/object-not-found":     "File path not found.",
            "storage/quota-exceeded":       "Storage quota exceeded.",
            "storage/unauthenticated":      "You must be logged in to upload.",
            "storage/retry-limit-exceeded": "Upload timed out. Check your connection.",
          };
          reject(new Error(msgs[error.code] || `Upload failed: ${error.message}`));
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  };

  // ── Save profile ────────────────────────────────────────────────
  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!form.firstName?.trim() || !form.lastName?.trim()) {
      setSaveMsg("❌ First and last name are required.");
      return;
    }

    setSaving(true);
    setSaveMsg("");
    setUploadProgress(0);

    try {
      let newPhotoURL = photoURL;

      if (photoFile) {
        setSaveMsg("⏳ Uploading photo...");
        newPhotoURL = await uploadPhoto(user, photoFile);
        setPhotoURL(newPhotoURL);
      }

      await updateDoc(doc(db, "users", user.uid), {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        address:   form.address?.trim() || "",
        lat:       parseFloat(form.lat) || null,
        lon:       parseFloat(form.lon) || null,
        photoURL:  newPhotoURL || null,
      });

      setUserName({ first: form.firstName.trim(), last: form.lastName.trim() });
      setAddress(form.address?.trim() || "");
      setLocation({ lat: form.lat, lon: form.lon });
      setPhotoFile(null);
      setPhotoPreview(null);
      setEditMode(false);
      setUploadProgress(0);
      setSaveMsg("✅ Profile updated successfully.");
      setTimeout(() => setSaveMsg(""), 4000);

    } catch (err) {
      console.error("Save failed:", err);
      setSaveMsg(`❌ ${err.message}`);
      setUploadProgress(0);
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
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditMode(false);
    setSaveMsg("");
    setUploadProgress(0);
  };

  // ── Change password ─────────────────────────────────────────────
  const handlePasswordChange = async () => {
    setPwMsg("");
    if (newPw !== confirmPw)  { setPwMsg("❌ Passwords do not match."); return; }
    if (newPw.length < 6)     { setPwMsg("❌ Password must be at least 6 characters."); return; }

    const user = auth.currentUser;
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);
      setPwMsg("✅ Password changed successfully.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setShowPwSection(false);
      setTimeout(() => setPwMsg(""), 4000);
    } catch (err) {
      const msgs = {
        "auth/wrong-password":    "❌ Current password is incorrect.",
        "auth/too-many-requests": "❌ Too many attempts. Please try again later.",
        "auth/weak-password":     "❌ New password is too weak.",
      };
      setPwMsg(msgs[err.code] || `❌ ${err.message}`);
    }
  };

  const navClass     = ({ isActive }) => (isActive ? "active" : undefined);
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
          <NavLink to="/dashboard"       className={navClass}>Dashboard</NavLink>
          <NavLink to="/register-farmer" className={navClass}>
            <span className="pf-notif-link">
              Register Farmer
              {pendingCount > 0 && (
                <span className="pf-notif-badge">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farmers"         className={navClass}>Farmers</NavLink>
          <NavLink to="/notifications"   className={navClass}>
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
          <NavLink to="/profile"    className={navClass}>Profile</NavLink>
        </nav>

        <button className="pf-logout" onClick={handleLogout}>Logout</button>
      </aside>

      {/* ── MAIN ── */}
      <main className="pf-main">

        <div className="pf-topbar">
          <div>
            <h1 className="pf-page-title">PROFILE</h1>
            <p className="pf-page-sub">Manage your account information</p>
          </div>
        </div>

        <div className="pf-content-grid">

          {/* LEFT — Avatar + quick info */}
          <div className="pf-left-col">
            <div className="pf-card pf-avatar-card">

              <div
                className={`pf-big-avatar-wrap${editMode ? " pf-big-avatar-wrap--editable" : ""}`}
                onClick={() => editMode && fileInputRef.current?.click()}
                title={editMode ? "Click to change photo" : undefined}
              >
                {displayPhoto
                  ? <img src={displayPhoto} alt="Profile" className="pf-big-avatar-img" />
                  : <div className="pf-big-avatar-initials">
                      {userName.first ? getInitials(userName.first, userName.last) : "AD"}
                    </div>
                }
                {editMode && (
                  <div className="pf-avatar-overlay">
                    <span className="pf-avatar-overlay-icon">📷</span>
                    <span className="pf-avatar-overlay-text">Change Photo</span>
                  </div>
                )}
              </div>

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handlePhotoChange}
              />

              {saving && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="pf-upload-progress-wrap">
                  <div
                    className="pf-upload-progress-bar"
                    style={{ width: `${uploadProgress}%` }}
                  />
                  <span className="pf-upload-progress-label">
                    Uploading {uploadProgress}%
                  </span>
                </div>
              )}

              {photoFile && !saving && (
                <p className="pf-photo-filename">📎 {photoFile.name}</p>
              )}

              <p className="pf-big-name">
                {userName.first ? `${userName.first} ${userName.last}` : "Loading..."}
              </p>
              <p className="pf-big-role">Registered Admin</p>
              <p className="pf-big-email">{email}</p>

              {!editMode && (
                <button
                  className="pf-edit-btn"
                  onClick={() => { setEditMode(true); setSaveMsg(""); }}
                  type="button"
                >
                  Edit Profile
                </button>
              )}
            </div>

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
                {editMode && <span className="pf-editing-badge">Editing</span>}
              </div>

              {saveMsg && (
                <div className={`pf-msg ${saveMsg.includes("✅") ? "pf-msg--ok" : "pf-msg--err"}`}>
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
                        placeholder="First name"
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
                        placeholder="Last name"
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
                        placeholder="City, Province, Country"
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
                    type="button"
                  >
                    {saving
                      ? (uploadProgress > 0 && uploadProgress < 100
                          ? `Uploading ${uploadProgress}%...`
                          : "Saving...")
                      : "Save Changes"}
                  </button>
                  <button
                    className="pf-cancel-btn"
                    onClick={handleCancel}
                    disabled={saving}
                    type="button"
                  >
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
                  type="button"
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
                    <div className={`pf-msg ${pwMsg.includes("✅") ? "pf-msg--ok" : "pf-msg--err"}`}>
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
                    <button
                      className="pf-save-btn"
                      onClick={handlePasswordChange}
                      type="button"
                    >
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