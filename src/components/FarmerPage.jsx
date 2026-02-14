// src/pages/FarmerPage.jsx
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaTrash } from "react-icons/fa";
import { auth, database } from "../firebase";
import { ref, get } from "firebase/database";
import { signOut } from "firebase/auth";
import "./FarmerPage.css";

export default function FarmerPage() {
  const navigate = useNavigate(); // navigation added

  const [farmers, setFarmers] = useState([
    { id: 1, first: "Jose", last: "Cruz", email: "jose.cruz@example.com" },
    { id: 2, first: "Maria", last: "Reyes", email: "maria.reyes@example.com" },
    { id: 3, first: "Andres", last: "Santos", email: "a.santos@example.com" },
    { id: 4, first: "Ligaya", last: "Torres", email: "torres.ligaya@example.com" },
    { id: 5, first: "Amihan", last: "Ramos", email: "amihan@example.com" },
    { id: 6, first: "Bayani", last: "Garcia", email: "bayani23@example.com" },
    { id: 7, first: "Lakan", last: "Dela Cruz", email: "lakan@example.com" },
    { id: 8, first: "Pedro", last: "Lopez", email: "lopez.pedro@example.com" },
  ]);

  const [userName, setUserName] = useState({ first: "", last: "" });

  // ✅ Logout function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login"); // redirect to login page
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Fetch logged-in user's name from Firebase
  useEffect(() => {
    const fetchUserName = async () => {
      const user = auth.currentUser;
      if (user) {
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setUserName({
            first: data.firstName || "",
            last: data.lastName || "",
          });
        }
      }
    };

    const timeout = setTimeout(fetchUserName, 500);
    return () => clearTimeout(timeout);
  }, []);

  const handleRemove = (id) => {
    setFarmers(farmers.filter((f) => f.id !== id));
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
          <h4>{userName.first} {userName.last}</h4>
          <p>Registered Admin</p>
        </div>

        <nav className="f-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers" className="active">Farmers</NavLink>
          <NavLink to="/soil-status">Soil Moisture Status</NavLink>
          <NavLink to="/notifications">Notification</NavLink>
          <NavLink to="/terms">Terms and Conditions</NavLink>
          <NavLink to="/privacy">Privacy Policy</NavLink>
          <NavLink to="/report">Report</NavLink>
        </nav>

        {/* ✅ Logout now redirects */}
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

          {farmers.map((f) => (
            <div className="f-row" key={f.id}>
              <span>{f.first}</span>
              <span>{f.last}</span>
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
          ))}
        </section>
      </main>
    </div>
  );
}
