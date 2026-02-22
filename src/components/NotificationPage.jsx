// src/components/NotificationPage.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDoc
} from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import "./NotificationPage.css";

export default function NotificationPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [userName, setUserName] = useState({ first: "", last: "" });

  // ✅ Logout function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // ✅ Fetch logged-in admin's name from Firestore
  useEffect(() => {
    const fetchUserName = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserName({
            first: data.firstName || "",
            last: data.lastName || "",
          });
        } else {
          console.warn("User document not found in Firestore");
        }
      } catch (err) {
        console.error("Error fetching user data from Firestore:", err);
      }
    };

    fetchUserName();
  }, []);

  // ✅ Real-time Notifications
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userID", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setNotifications(list);
    });

    return () => unsubscribe();
  }, []);

  // ✅ Mark notification as read
  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "notifications", id), {
        isRead: true,
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  return (
    <div className="dashboard">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="logo">
          <span className="italic">Smart</span>AGRI
        </h2>

        <div className="profile">
          <div className="avatar"></div>
          <h4>
            {userName.first || "Loading..."} {userName.last}
          </h4>
          <span className="role">Registered Admin</span>
        </div>

        <nav className="menu">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/register-farmer">Register Farmer</Link>
          <Link to="/farmers">Farmers</Link>
          <Link to="/soil-status">Soil Moisture Status</Link>
          <Link to="/notifications" className="active">Notification</Link>
        </nav>

        <button className="logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        <header className="header">
          <h1>Notification</h1>
          <p>View and Manage Notifications</p>
        </header>

        <div className="notification-container">
          {notifications.length === 0 ? (
            <p style={{ textAlign: "center", marginTop: "20px", fontStyle: "italic", color: "#555" }}>
              No notifications available.
            </p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`notification-card ${notif.type} ${
                  notif.isRead ? "read" : ""
                }`}
                onClick={() => markAsRead(notif.id)}
              >
                <div className="notif-content">
                  <h4>{notif.message}</h4>
                  <p>{notif.timestamp?.toDate().toLocaleString()}</p>
                </div>

                <div className="device-id">
                  DEVICE ID: {notif.deviceID || "N/A"}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}