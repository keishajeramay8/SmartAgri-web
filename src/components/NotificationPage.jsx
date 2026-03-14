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
  getDoc
} from "firebase/firestore";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

const NotificationPage = ({ fcmMessage }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [userName, setUserName] = useState({ first: "", last: "" });

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

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
            first: data.fname || "",
            last: data.lname || "",
          });
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };
    fetchUserName();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "notifications"),
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
  }, []);

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

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid, "notifications", id), {
        read: true,
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
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

  return (
    <div className="rf-dashboard">
      <aside className="rf-sidebar">
        <h2 className="rf-logo"><span className="smart">Smart</span>AGRI</h2>
        <div className="rf-profile">
          <div className="rf-avatar"></div>
          <h4>{userName.first || "Loading..."} {userName.last}</h4>
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

        <button className="rf-logout" onClick={handleLogout}>Logout</button>
      </aside>

      <main className="rf-main">
        <header className="rf-header">
          <h1>Notifications Timeline</h1>
          <p>See your notifications in a chronological timeline.</p>
        </header>

        <div className="timeline-container">
          {notifications.length === 0 ? (
            <p className="no-notifications">No notifications yet.</p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`timeline-item ${notif.read ? "read" : ""}`}
                onClick={() => markAsRead(notif.id)}
              >
                <div className="timeline-dot" style={{ backgroundColor: getColor(notif.type) }}></div>
                <div className="timeline-content">
                  <h4>{notif.title}</h4>
                  <p>{notif.body}</p>
                  <small>{notif.createdAt?.toLocaleString()}</small>
                  {notif.deviceId && <span className="device-id">{notif.deviceId}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default NotificationPage;