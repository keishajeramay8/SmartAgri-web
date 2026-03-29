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

  // Modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [notifToDelete, setNotifToDelete] = useState(null);

  // Delete All Modal
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  // ===== Unread count =====
  const unreadCount = notifications.filter((n) => !n.read).length;

  // 🔹 LOGOUT
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // 🔹 TRACK AUTH STATE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // 🔹 FETCH USER NAME
  useEffect(() => {
    if (!currentUser) return;

    const fetchUserName = async () => {
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserName({ first: data.fname || "", last: data.lname || "" });
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    fetchUserName();
  }, [currentUser]);

  // 🔹 FETCH NOTIFICATIONS
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
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : data.createdAt,
        };
      });
      setNotifications(list);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 🔹 HANDLE FCM MESSAGE
  useEffect(() => {
    if (!fcmMessage) return;

    const newNotif = {
      id: fcmMessage.data?.notifId || new Date().getTime(),
      title: fcmMessage.notification?.title || "New Notification",
      body: fcmMessage.notification?.body || "",
      type: "alert",
      read: false,
      deviceId: fcmMessage.data?.deviceId || null,
      createdAt: new Date(),
    };

    setNotifications((prev) => [newNotif, ...prev]);
  }, [fcmMessage]);

  // 🔹 MARK ONE AS READ
  const markAsRead = async (id) => {
    try {
      await updateDoc(
        doc(db, "users", currentUser.uid, "notifications", id),
        { read: true }
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // 🔹 DELETE ONE NOTIF
  const deleteNotification = async (id) => {
    try {
      await deleteDoc(
        doc(db, "users", currentUser.uid, "notifications", id)
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // 🔹 DELETE ALL NOTIFS
  const deleteAllNotifications = async () => {
    if (!currentUser) return;
    try {
      const notifRef = collection(db, "users", currentUser.uid, "notifications");
      const snapshot = await getDocs(notifRef);
      const deletes = snapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, "users", currentUser.uid, "notifications", docSnap.id))
      );
      await Promise.all(deletes);
    } catch (error) {
      console.error("Error deleting all notifications:", error);
    }
  };

  // 🔹 MARK ALL AS READ
  const markAllAsRead = async () => {
    if (!currentUser) return;
    try {
      const notifRef = collection(db, "users", currentUser.uid, "notifications");
      const snapshot = await getDocs(notifRef);
      const updates = snapshot.docs.map((docSnap) =>
        updateDoc(
          doc(db, "users", currentUser.uid, "notifications", docSnap.id),
          { read: true }
        )
      );
      await Promise.all(updates);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getColor = (type) => {
    switch (type) {
      case "alert": return "#fb8c00";
      case "update": return "#43a047";
      case "weatherUpdate": return "#00acc1";
      default: return "#757575";
    }
  };

  if (!currentUser) return <p>Loading user...</p>;

  return (
    <div className="rf-dashboard">
      <aside className="rf-sidebar">
        <h2 className="rf-logo">
          <span className="smart">Smart</span>AGRI
        </h2>

        <div className="rf-profile">
          <div className="rf-avatar"></div>
          <h4>{userName.first || "Loading..."} {userName.last}</h4>
          <p>Registered Admin</p>
        </div>

        <nav className="rf-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>

          {/* ===== Notification link with unread badge ===== */}
          <NavLink to="/notifications" className="active notif-nav-link">
            Notification
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
            )}
          </NavLink>

          <NavLink to="/farm-group">Farm Group</NavLink>
          <hr />
        </nav>

        <button className="rf-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="rf-main">
        <div className="notif-actions">
          {/* ===== Unread count summary ===== */}
          {unreadCount > 0 && (
            <p className="unread-summary">
              You have <strong>{unreadCount}</strong> unread notification{unreadCount > 1 ? "s" : ""}
            </p>
          )}

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

        <div className="timeline-container">
          {notifications.length === 0 ? (
            <p className="no-notifications">No notifications yet.</p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`timeline-item ${notif.read ? "read" : ""}`}
              >
                <div
                  className="timeline-dot"
                  style={{ backgroundColor: getColor(notif.type) }}
                ></div>

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
                      onClick={(e) => { e.stopPropagation(); setNotifToDelete(notif.id); setShowConfirm(true); }}
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

      {/* ===== Delete One Confirm Modal ===== */}
      {showConfirm && (
        <div className="confirm-modal">
          <div className="confirm-content">
            <p>Are you sure you want to delete this notification?</p>
            <div className="confirm-buttons">
              <button
                className="read-btn"
                onClick={() => { deleteNotification(notifToDelete); setShowConfirm(false); setNotifToDelete(null); }}
              >
                Yes
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

      {/* ===== Delete All Confirm Modal ===== */}
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