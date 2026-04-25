// src/pages/RegisterFarmerPage.jsx
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  setDoc,
  serverTimestamp,
  getDoc,
  orderBy,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";

import "./RegisterFarmerPage.css";

export default function RegisterFarmerPage() {
  const navigate = useNavigate();

  const [farmers, setFarmers] = useState([]);
  const [userName, setUserName] = useState({ first: "", last: "" });
  const [photoURL, setPhotoURL] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const navClass = ({ isActive }) => (isActive ? "active" : undefined);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const getInitials = (first = "", last = "") =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  // Fetch Admin Name + Photo
  useEffect(() => {
    const fetchAdminName = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserName({ first: data.firstName || "", last: data.lastName || "" });
          setPhotoURL(data.photoURL || "");
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAdminName();
  }, []);

  // Realtime Unread Notifications
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const unread = snapshot.docs.filter((d) => !d.data().read).length;
      setUnreadCount(unread);
    });
    return () => unsubscribe();
  }, []);

  // ─── Mark all current join requests as seen (clears the badge) ───
  // Called once on mount so the admin badge goes to 0 while on this page.
  useEffect(() => {
    const markAllSeen = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const groupQuery = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );
        const groupSnapshot = await getDocs(groupQuery);
        await Promise.all(
          groupSnapshot.docs.map(async (groupDoc) => {
            const joinRef = collection(db, "farmgroups", groupDoc.id, "joinRequests");
            const joinSnap = await getDocs(joinRef);
            return Promise.all(
              joinSnap.docs.map((jDoc) =>
                updateDoc(doc(db, "farmgroups", groupDoc.id, "joinRequests", jDoc.id), {
                  seenByAdmin: true,
                })
              )
            );
          })
        );
      } catch (err) {
        console.error("Error marking join requests as seen:", err);
      }
    };
    markAllSeen();
  }, []);

  // ─── Realtime Pending Farmer Requests — only UNSEEN count for badge ───
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    let unsubscribers = [];

    const setupListeners = async () => {
      setLoading(true);
      try {
        const groupQuery = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );
        const groupSnapshot = await getDocs(groupQuery);
        const countMap = {};
        const farmersMap = {};

        for (const groupDoc of groupSnapshot.docs) {
          const groupId = groupDoc.id;
          const groupData = groupDoc.data();
          countMap[groupId] = 0;
          farmersMap[groupId] = [];

          const joinRef = collection(db, "farmgroups", groupId, "joinRequests");

          const unsub = onSnapshot(joinRef, async (snap) => {
            // Badge: only count requests not yet seen
            countMap[groupId] = snap.docs.filter((d) => !d.data().seenByAdmin).length;
            const total = Object.values(countMap).reduce((a, b) => a + b, 0);
            setPendingCount(total);

            // Table: show ALL pending requests (seen or not)
            const farmerList = await Promise.all(
              snap.docs.map(async (requestDoc) => {
                const farmerUid = requestDoc.id;
                const farmerSnap = await getDoc(doc(db, "users", farmerUid));
                return {
                  id: farmerUid,
                  groupId,
                  groupName: groupData.farmgroupName || "",
                  ...(farmerSnap.exists() ? farmerSnap.data() : {}),
                };
              })
            );
            farmersMap[groupId] = farmerList;
            const allFarmers = Object.values(farmersMap).flat();
            setFarmers(allFarmers);
            setLoading(false);
          });

          unsubscribers.push(unsub);
        }

        if (groupSnapshot.empty) setLoading(false);
      } catch (error) {
        console.error("Error loading pending farmers:", error);
        setLoading(false);
      }
    };

    setupListeners();
    return () => unsubscribers.forEach((fn) => fn());
  }, []);

  // Approve Farmer
  const handleApprove = async (farmer) => {
    try {
      await setDoc(
        doc(db, "farmgroups", farmer.groupId, "members", farmer.id),
        { farmerUid: farmer.id, joinedAt: serverTimestamp() }
      );
      await deleteDoc(
        doc(db, "farmgroups", farmer.groupId, "joinRequests", farmer.id)
      );
    } catch (error) {
      console.error(error);
    }
  };

  // Reject Farmer
  const handleReject = async (farmer) => {
    try {
      await deleteDoc(
        doc(db, "farmgroups", farmer.groupId, "joinRequests", farmer.id)
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="f-dashboard">

      {/* ── SIDEBAR ── */}
      <aside className="f-sidebar">
        <div className="f-logo">
          <span className="smart">Smart</span>AGRI
        </div>

        <div className="f-profile">
          <div className="f-avatar">
            {photoURL
              ? <img src={photoURL} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : (userName.first ? getInitials(userName.first, userName.last) : "AD")
            }
          </div>
          <div>
            <p className="f-profile-name">
              {userName.first ? `${userName.first} ${userName.last}` : "Loading..."}
            </p>
            <p className="f-profile-role">Registered Admin</p>
          </div>
        </div>

        <nav className="f-menu">
          <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
          <NavLink to="/register-farmer" className={navClass}>
            <span className="f-notif-link">
              Register Farmer
              {pendingCount > 0 && (
                <span className="f-notif-badge">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farmers" className={navClass}>Farmers</NavLink>
          <NavLink to="/notifications" className={navClass}>
            <span className="f-notif-link">
              Notification
              {unreadCount > 0 && (
                <span className="f-notif-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farm-group" className={navClass}>Farm Group</NavLink>
          <NavLink to="/profile" className={navClass}>Profile</NavLink>
        </nav>

        <button className="f-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* ── MAIN ── */}
      <main className="f-main">

        <div className="f-header">
          <div>
            <h1 className="f-page-title">PENDING FARMER REQUESTS</h1>
            <p className="f-page-sub">Review and manage incoming join requests</p>
          </div>
        </div>

        <div className="f-stats">
          <div className="f-stat">
            <p className="f-stat-label">Pending Requests</p>
            <p className="f-stat-val">{farmers.length}</p>
          </div>
          <div className="f-stat">
            <p className="f-stat-label">Farm Groups</p>
            <p className="f-stat-val">
              {[...new Set(farmers.map((f) => f.groupId))].length}
            </p>
          </div>
          <div className="f-stat">
            <p className="f-stat-label">Status</p>
            <p className="f-stat-val" style={{ fontSize: "14px", paddingTop: "4px" }}>
              {loading ? "Loading..." : farmers.length > 0 ? "Action Needed" : "All Clear"}
            </p>
          </div>
        </div>

        <div className="f-table-section">
          <div className="f-card-header">
            <h2 className="f-card-title">Join Requests</h2>
            {farmers.length > 0 && (
              <span className="f-pending-badge">
                {farmers.length} pending
              </span>
            )}
          </div>

          <div className="f-table-header">
            <span>First Name</span>
            <span>Last Name</span>
            <span>Email Address</span>
          </div>

          {loading && (
            <div className="f-loading">Loading requests...</div>
          )}

          {!loading && farmers.map((f) => (
            <div className="f-row" key={f.id}>
              <span>{f.firstName || "—"}</span>
              <span>{f.lastName || "—"}</span>
              <span>{f.email || "—"}</span>
              <div className="f-actions">
                <button className="approve" onClick={() => handleApprove(f)} title="Approve">
                  ✓
                </button>
                <button className="remove" onClick={() => handleReject(f)} title="Reject">
                  ✕
                </button>
              </div>
            </div>
          ))}

          {!loading && farmers.length === 0 && (
            <div className="f-empty">
              <span>🌱</span>
              <p>No pending requests at the moment.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}