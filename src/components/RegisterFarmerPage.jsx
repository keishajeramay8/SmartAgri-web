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
} from "firebase/firestore";

import "./RegisterFarmerPage.css";

export default function RegisterFarmerPage() {
  const navigate = useNavigate();

  const [farmers, setFarmers] = useState([]);
  const [userName, setUserName] = useState({ first: "", last: "" });
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // =========================
  // Logout
  // =========================
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // =========================
  // Initials helper
  // =========================
  const getInitials = (first = "", last = "") =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  // =========================
  // Fetch Admin Name
  // =========================
  useEffect(() => {
    const fetchAdminName = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserName({ first: data.firstName || "", last: data.lastName || "" });
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAdminName();
  }, []);

  // =========================
  // Realtime Unread Notifications
  // =========================
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

  // =========================
  // Load Pending Join Requests
  // =========================
  useEffect(() => {
    const loadPendingFarmers = async () => {
      const user = auth.currentUser;
      if (!user) return;
      setLoading(true);
      try {
        const groupQuery = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );
        const groupSnapshot = await getDocs(groupQuery);
        let pendingFarmers = [];

        for (const groupDoc of groupSnapshot.docs) {
          const groupId = groupDoc.id;
          const groupData = groupDoc.data();
          const joinRef = collection(db, "farmgroups", groupId, "joinRequests");
          const joinSnapshot = await getDocs(joinRef);

          const farmerList = await Promise.all(
            joinSnapshot.docs.map(async (requestDoc) => {
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
          pendingFarmers = [...pendingFarmers, ...farmerList];
        }
        setFarmers(pendingFarmers);
      } catch (error) {
        console.error("Error loading pending farmers:", error);
      }
      setLoading(false);
    };
    loadPendingFarmers();
  }, []);

  // =========================
  // Approve Farmer
  // =========================
  const handleApprove = async (farmer) => {
    try {
      await setDoc(
        doc(db, "farmgroups", farmer.groupId, "members", farmer.id),
        { farmerUid: farmer.id, joinedAt: serverTimestamp() }
      );
      await deleteDoc(
        doc(db, "farmgroups", farmer.groupId, "joinRequests", farmer.id)
      );
      setFarmers((prev) => prev.filter((f) => f.id !== farmer.id));
    } catch (error) {
      console.error(error);
    }
  };

  // =========================
  // Reject Farmer
  // =========================
  const handleReject = async (farmer) => {
    try {
      await deleteDoc(
        doc(db, "farmgroups", farmer.groupId, "joinRequests", farmer.id)
      );
      setFarmers((prev) => prev.filter((f) => f.id !== farmer.id));
    } catch (error) {
      console.error(error);
    }
  };

  // =========================
  // UI Render
  // =========================
  return (
    <div className="f-dashboard">

      {/* ── SIDEBAR ── */}
      <aside className="f-sidebar">
        <div className="f-logo">
          <span className="smart">Smart</span>AGRI
        </div>

        <div className="f-profile">
          <div className="f-avatar">
            {userName.first ? getInitials(userName.first, userName.last) : "AD"}
          </div>
          <div>
            <p className="f-profile-name">
              {userName.first ? `${userName.first} ${userName.last}` : "Loading..."}
            </p>
            <p className="f-profile-role">Registered Admin</p>
          </div>
        </div>

        <nav className="f-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer" className="active">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/notifications">
            <span className="f-notif-link">
              Notification
              {unreadCount > 0 && (
                <span className="f-notif-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farm-group">Farm Group</NavLink>
        </nav>

        <button className="f-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* ── MAIN ── */}
      <main className="f-main">

        {/* TOP BAR */}
        <div className="f-header">
          <div>
            <h1 className="f-page-title">Pending Farmer Requests</h1>
            <p className="f-page-sub">Review and manage incoming join requests</p>
          </div>
        </div>

        {/* STATS ROW */}
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

        {/* TABLE CARD */}
        <div className="f-table-section">
          <div className="f-card-header">
            <h2 className="f-card-title">Join Requests</h2>
            {farmers.length > 0 && (
              <span className="f-pending-badge">
                {farmers.length} pending
              </span>
            )}
          </div>

          {/* Table Header */}
          <div className="f-table-header">
            <span>First Name</span>
            <span>Last Name</span>
            <span>Email Address</span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="f-loading">Loading requests...</div>
          )}

          {/* Rows */}
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

          {/* Empty State */}
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