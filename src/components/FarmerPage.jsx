// src/pages/FarmerPage.jsx
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaTrash } from "react-icons/fa";
import { auth, db } from "../firebase"; // db is Firestore
import { doc, getDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import "./FarmerPage.css";

export default function FarmerPage({ farmGroupId }) {
  const navigate = useNavigate();

  const [farmers, setFarmers] = useState([]);
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

  // Fetch logged-in admin's name from Firestore
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

  // Fetch farmers of the farmgroup from Firestore
  useEffect(() => {
    const fetchFarmers = async () => {
      if (!farmGroupId) return;

      try {
        const farmersCollectionRef = collection(db, `FarmGroups/${farmGroupId}/farmers`);
        const snapshot = await getDocs(farmersCollectionRef);
        if (!snapshot.empty) {
          const farmerArray = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setFarmers(farmerArray);
        } else {
          setFarmers([]);
        }
      } catch (err) {
        console.error("Failed to fetch farmers:", err);
      }
    };

    fetchFarmers();
  }, [farmGroupId]);

  // Delete farmer from farmgroup
  const handleRemove = async (id) => {
    if (!window.confirm("Are you sure you want to remove this farmer?")) return;

    try {
      const farmerDocRef = doc(db, `FarmGroups/${farmGroupId}/farmers`, id);
      await deleteDoc(farmerDocRef);
      setFarmers(farmers.filter((f) => f.id !== id));
      alert("Farmer removed successfully.");
    } catch (error) {
      console.error("Failed to remove farmer:", error);
      alert("Failed to remove farmer.");
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
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers" className="active">Farmers</NavLink>
          <NavLink to="/soil-status">Soil Moisture Status</NavLink>
          <NavLink to="/notifications">Notification</NavLink>
          
        </nav>

        <button className="f-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="f-main">
        <header className="f-header">
          <h1>FARMER MANAGEMENT</h1>
        </header>

        <section className="f-table-section">
          <div className="f-table-header">
            <span>FIRST NAME</span>
            <span>LAST NAME</span>
            <span>EMAIL ADDRESS</span>
            <span>ACTIONS</span>
          </div>

          {farmers.length === 0 ? (
            <p style={{ textAlign: "center", marginTop: "20px", fontStyle: "italic", color: "#555" }}>
              No farmers have joined this farmgroup yet.
            </p>
          ) : (
            farmers.map((f) => (
              <div className="f-row" key={f.id}>
                <span>{f.firstName}</span>
                <span>{f.lastName}</span>
                <span>{f.email}</span>
                <div className="f-actions">
                  <button
                    className="delete-icon"
                    onClick={() => handleRemove(f.id)}
                    title="Delete Farmer"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}