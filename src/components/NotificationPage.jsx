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
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

export default function NotificationPage() {

  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [userName, setUserName] = useState({ first: "", last: "" });

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Fetch admin name
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

        }

      } catch (err) {

        console.error("Error fetching user data:", err);

      }

    };

    fetchUserName();

  }, []);

  // Real-time notifications
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

  // Mark as read
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

    <div className="rf-dashboard">

      {/* SIDEBAR */}
      <aside className="rf-sidebar">

        <h2 className="rf-logo">
          <span className="smart">Smart</span>AGRI
        </h2>

        <div className="rf-profile">

          <div className="rf-avatar"></div>

          <h4>
            {userName.first || "Loading..."} {userName.last}
          </h4>

          <p>Registered Admin</p>

        </div>

        <nav className="rf-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/notifications" className="active">Notification</NavLink>
          <NavLink to="/farm-group">Farm Group</NavLink>
          <hr />
        </nav>

        <button className="rf-logout" onClick={handleLogout}>
          Logout
        </button>

      </aside>

      {/* MAIN CONTENT */}
      <main className="rf-main">

        <header className="rf-header">
          <h1>Notification</h1>
          <p>View and Manage Notifications</p>
        </header>

        <div className="notification-container">

          {notifications.length === 0 ? (

            <p className="no-notifications">
              No notifications available.
            </p>

          ) : (

            notifications.map((notif) => (

              <div
                key={notif.id}
                className={`notification-card ${notif.type} ${notif.isRead ? "read" : ""}`}
                onClick={() => markAsRead(notif.id)}
              >

                <div className="notif-content">

                  <h4>{notif.message}</h4>

                  <p>
                    {notif.timestamp?.toDate().toLocaleString()}
                  </p>

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