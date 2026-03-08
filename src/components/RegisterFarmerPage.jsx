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
  getDoc
} from "firebase/firestore";

import "./RegisterFarmerPage.css";

export default function RegisterFarmerPage() {

  const navigate = useNavigate();

  const [farmers, setFarmers] = useState([]);
  const [userName, setUserName] = useState({ first: "", last: "" });
  const [loading, setLoading] = useState(false);

  // =========================
  // Logout
  // =========================
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

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

          setUserName({
            first: data.firstName || "",
            last: data.lastName || "",
          });
        }

      } catch (err) {
        console.error(err);
      }
    };

    fetchAdminName();
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

        // Farmgroups created by admin
        const groupQuery = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );

        const groupSnapshot = await getDocs(groupQuery);

        let pendingFarmers = [];

        for (const groupDoc of groupSnapshot.docs) {

          const groupId = groupDoc.id;
          const groupData = groupDoc.data();

          // Join request subcollection (based on your screenshot)
          const joinRef = collection(
            db,
            "farmgroups",
            groupId,
            "joinRequests"
          );

          const joinSnapshot = await getDocs(joinRef);

          const farmerList = await Promise.all(
            joinSnapshot.docs.map(async (requestDoc) => {

              const farmerUid = requestDoc.id;

              // Fetch farmer profile
              const farmerSnap = await getDoc(
                doc(db, "users", farmerUid)
              );

              return {
                id: farmerUid,
                groupId,
                groupName: groupData.farmgroupName || "",
                ...(farmerSnap.exists() ? farmerSnap.data() : {})
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

      // Add to members collection
      await setDoc(
        doc(db, "farmgroups", farmer.groupId, "members", farmer.id),
        {
          farmerUid: farmer.id,
          joinedAt: serverTimestamp()
        }
      );

      // Remove request
      await deleteDoc(
        doc(db, "farmgroups", farmer.groupId, "joinRequests", farmer.id)
      );

      setFarmers(prev =>
        prev.filter(f => f.id !== farmer.id)
      );

      alert("Farmer approved!");

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

      setFarmers(prev =>
        prev.filter(f => f.id !== farmer.id)
      );

      alert("Farmer rejected.");

    } catch (error) {
      console.error(error);
    }
  };

  // =========================
  // UI Render
  // =========================
  return (
    <div className="f-dashboard">

      {/* SIDEBAR */}
      <aside className="f-sidebar">

        <h2 className="f-logo">
          <span className="smart">Smart</span>AGRI
        </h2>

        <div className="f-profile">
          <div className="f-avatar"></div>

          <h4>
            {userName.first || "Loading..."} {userName.last}
          </h4>

          <p>Registered Admin</p>
        </div>

        <nav className="f-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer" className="active">
            Register Farmer
          </NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/soil-status">Soil Moisture Status</NavLink>
            <NavLink to="/notifications">Notification</NavLink>
          <NavLink to="/farm-group">Farm Group</NavLink>
        </nav>

        <button className="f-logout" onClick={handleLogout}>
          Logout
        </button>

      </aside>

      {/* MAIN CONTENT */}
      <main className="f-main">

        <header className="f-header">
          <h1>PENDING FARMER REQUESTS</h1>
        </header>

        <section className="f-table-section">

          {/* Header */}
          <div className="f-table-header">
            <span>FIRST NAME</span>
            <span>LAST NAME</span>
            <span>EMAIL ADDRESS</span>
            <span>ACTIONS</span>
          </div>

          {/* Loading */}
          {loading && (
            <p style={{ textAlign: "center" }}>Loading requests...</p>
          )}

          {/* Rows */}
          {farmers.map(f => (
            <div className="f-row" key={f.id}>

              <span>{f.firstName || ""}</span>
              <span>{f.lastName || ""}</span>
              <span>{f.email || ""}</span>

              <div className="f-actions">

                <button
                  className="approve"
                  onClick={() => handleApprove(f)}
                >
                  ✓
                </button>

                <button
                  className="remove"
                  onClick={() => handleReject(f)}
                >
                  ✕
                </button>

              </div>
            </div>
          ))}

          {/* Empty State */}
          {!loading && farmers.length === 0 && (
            <div style={{
              textAlign: "center",
              marginTop: "20px",
              fontStyle: "italic",
              color: "#555"
            }}>
              No pending requests.
            </div>
          )}

        </section>
      </main>
    </div>
  );
}