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

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // ✅ Load Admin Name from Firestore
  useEffect(() => {
    const fetchAdminName = async () => {
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
        console.error("Error fetching admin name:", err);
      }
    };

    fetchAdminName();
  }, []);

  // ✅ Load ONLY Pending Farmers from Admin's Farmgroups
  useEffect(() => {
    const loadPendingFarmers = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const groupQuery = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );

        const groupSnapshot = await getDocs(groupQuery);
        let allPending = [];

        for (const groupDoc of groupSnapshot.docs) {
          const groupId = groupDoc.id;
          const groupData = groupDoc.data();

          const pendingSnapshot = await getDocs(
            collection(db, "farmgroups", groupId, "pendingRequests")
          );

          const pendingList = pendingSnapshot.docs.map(docSnap => ({
            id: docSnap.id,
            groupId: groupId,
            groupName: groupData.farmgroupName,
            ...docSnap.data()
          }));

          allPending = [...allPending, ...pendingList];
        }

        setFarmers(allPending);

      } catch (error) {
        console.error("Error loading pending farmers:", error);
      }
    };

    loadPendingFarmers();
  }, []);

  // ✅ APPROVE Farmer
  const handleApprove = async (farmer) => {
    try {
      await setDoc(
        doc(db, "farmgroups", farmer.groupId, "members", farmer.id),
        {
          farmerUid: farmer.id,
          joinedAt: serverTimestamp()
        }
      );

      await deleteDoc(
        doc(db, "farmgroups", farmer.groupId, "pendingRequests", farmer.id)
      );

      setFarmers(farmers.filter(f => f.id !== farmer.id));

      alert("Farmer approved!");
    } catch (error) {
      console.error("Error approving farmer:", error);
    }
  };

  // ✅ REJECT Farmer
  const handleReject = async (farmer) => {
    try {
      await deleteDoc(
        doc(db, "farmgroups", farmer.groupId, "pendingRequests", farmer.id)
      );

      setFarmers(farmers.filter(f => f.id !== farmer.id));

      alert("Farmer rejected.");
    } catch (error) {
      console.error("Error rejecting farmer:", error);
    }
  };

  return (
    <div className="f-dashboard">

      {/* SIDEBAR */}
      <aside className="f-sidebar">
        <h2 className="f-logo">
          <span className="smart">Smart</span>AGRI
        </h2>

        <div className="f-profile">
          <div className="f-avatar"></div>
          <h4>{userName.first || "Loading..."} {userName.last}</h4>
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
         
        </nav>

        <button className="f-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <main className="f-main">
        <header className="f-header">
          <h1>PENDING FARMER REQUESTS</h1>
        </header>

        <section className="f-table-section">

          {/* Table Header */}
          <div className="f-table-header">
            <span>FIRST NAME</span>
            <span>LAST NAME</span>
            <span>EMAIL ADDRESS</span>
            <span>ACTIONS</span>
          </div>

          {/* Table Rows */}
          {farmers.length > 0 && farmers.map(f => (
            <div className="f-row" key={f.id}>
              <span>{f.firstName || f.farmerName || f.id}</span>
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

          {/* No Pending Requests Message */}
          {farmers.length === 0 && (
            <div style={{ textAlign: "center", marginTop: "20px", fontStyle: "italic", color: "#555" }}>
              No pending requests.
            </div>
          )}

        </section>
      </main>
    </div>
  );
}