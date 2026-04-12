import './NotificationPage.css';
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  deleteDoc,
  getDocs
} from "firebase/firestore";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";

const NotificationPage = ({ fcmMessage }) => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [userName, setUserName] = useState({ first: "", last: "" });
  const [notifications, setNotifications] = useState([]);

  const [showConfirm, setShowConfirm] = useState(false);
  const [notifToDelete, setNotifToDelete] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ─── Helpers ───
  const getInitials = (first = "", last = "") =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // ─── Auth State ───
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUser(user);
      else { setCurrentUser(null); navigate("/login"); }
    });
    return () => unsubscribe();
  }, [navigate]);

  // ─── Fetch User Name ───
  useEffect(() => {
    if (!currentUser) return;
    const fetchUserName = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserName({ first: data.firstName || data.fname || "", last: data.lastName || data.lname || "" });
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };
    fetchUserName();
  }, [currentUser]);

  // ─── Fetch Notifications ───
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "users", currentUser.uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        };
      });
      setNotifications(list);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // ─── FCM Message ───
  useEffect(() => {
    if (!fcmMessage) return;
    setNotifications((prev) => [{
      id: fcmMessage.data?.notifId || Date.now(),
      title: fcmMessage.notification?.title || "New Notification",
      body: fcmMessage.notification?.body || "",
      type: "alert",
      read: false,
      deviceId: fcmMessage.data?.deviceId || null,
      createdAt: new Date(),
    }, ...prev]);
  }, [fcmMessage]);

  // ─── Actions ───
  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "users", currentUser.uid, "notifications", id), { read: true });
    } catch (error) { console.error(error); }
  };

  const deleteNotification = async (id) => {
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "notifications", id));
    } catch (error) { console.error(error); }
  };

  const deleteAllNotifications = async () => {
    if (!currentUser) return;
    try {
      const snapshot = await getDocs(collection(db, "users", currentUser.uid, "notifications"));
      await Promise.all(snapshot.docs.map((d) =>
        deleteDoc(doc(db, "users", currentUser.uid, "notifications", d.id))
      ));
    } catch (error) { console.error(error); }
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;
    try {
      const snapshot = await getDocs(collection(db, "users", currentUser.uid, "notifications"));
      await Promise.all(snapshot.docs.map((d) =>
        updateDoc(doc(db, "users", currentUser.uid, "notifications", d.id), { read: true })
      ));
    } catch (error) { console.error(error); }
  };

  const getColor = (type) => {
    switch (type) {
      case "alert": return "#fb8c00";
      case "update": return "#43a047";
      case "weatherUpdate": return "#00acc1";
      default: return "#aaa";
    }
  };

  if (!currentUser) return <p>Loading user...</p>;

  return (
    <div className="rf-dashboard">

      {/* ── SIDEBAR ── */}
      <aside className="rf-sidebar">
        <div className="rf-logo">
          <span className="smart">Smart</span>AGRI
        </div>

        <div className="rf-profile">
          <div className="rf-avatar">
            {userName.first ? getInitials(userName.first, userName.last) : "AD"}
          </div>
          <div>
            <p className="rf-profile-name">
              {userName.first ? `${userName.first} ${userName.last}` : "Loading..."}
            </p>
            <p className="rf-profile-role">Registered Admin</p>
          </div>
        </div>

        <nav className="rf-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/notifications" className="active">
            <span className="notif-nav-link">
              Notification
              {unreadCount > 0 && (
                <span className="notif-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farm-group">Farm Group</NavLink>
        </nav>

        <button className="rf-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* ── MAIN ── */}
      <main className="rf-main">

        {/* TOP BAR */}
        <div className="notif-topbar">
          <div>
            <h1 className="notif-page-title">Notifications</h1>
            <p className="notif-page-sub">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "You're all caught up"}
            </p>
          </div>

          <div className="notif-action-buttons">
            <button className="mark-all-btn" onClick={markAllAsRead}>
              Mark All as Read
            </button>
            <button
              className="delete-all-btn"
              onClick={() => setShowDeleteAllConfirm(true)}
              disabled={notifications.length === 0}
            >
              Delete All
            </button>
          </div>
        </div>

        {/* NOTIFICATION LIST */}
        <div className="timeline-container">
          {notifications.length === 0 ? (
            <p className="no-notifications">
              <span style={{ fontSize: "36px" }}>🔔</span>
              No notifications yet.
            </p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`timeline-item${notif.read ? " read" : ""}`}
              >
                <div
                  className="timeline-dot"
                  style={{ backgroundColor: getColor(notif.type) }}
                />

                <div className="timeline-content">
                  <h4>{notif.title}</h4>
                  <p>{notif.body}</p>
                  <small>
                    {notif.createdAt ? notif.createdAt.toLocaleString() : "Loading time..."}
                  </small>

                  {notif.deviceId && (
                    <span className="device-id">Device: {notif.deviceId}</span>
                  )}

                  <div className="notif-buttons">
                    {!notif.read && (
                      <button
                        className="read-btn"
                        onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                      >
                        Mark as Read
                      </button>
                    )}
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotifToDelete(notif.id);
                        setShowConfirm(true);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* ── DELETE ONE MODAL ── */}
      {showConfirm && (
        <div className="confirm-modal">
          <div className="confirm-content">
            <p>Are you sure you want to delete this notification?</p>
            <div className="confirm-buttons">
              <button
                className="read-btn"
                onClick={() => {
                  deleteNotification(notifToDelete);
                  setShowConfirm(false);
                  setNotifToDelete(null);
                }}
              >
                Yes, Delete
              </button>
              <button
                className="delete-btn"
                onClick={() => { setShowConfirm(false); setNotifToDelete(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE ALL MODAL ── */}
      {showDeleteAllConfirm && (
        <div className="confirm-modal">
          <div className="confirm-content">
            <p>Are you sure you want to delete <strong>all</strong> notifications? This cannot be undone.</p>
            <div className="confirm-buttons">
              <button
                className="read-btn"
                onClick={() => { deleteAllNotifications(); setShowDeleteAllConfirm(false); }}
              >
                Yes, Delete All
              </button>
              <button
                className="delete-btn"
                onClick={() => setShowDeleteAllConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPage;