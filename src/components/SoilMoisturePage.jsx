// src/pages/SoilMoisturePage.jsx
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import "./RegisterFarmerPage.css";

export default function SoilMoisturePage() {
  const navigate = useNavigate();

  const [soilData, setSoilData] = useState([
    { id: 1, field: "Field A", location: "Zone 1", moisture: "30%" },
    { id: 2, field: "Field B", location: "Zone 2", moisture: "45%" },
    { id: 3, field: "Field C", location: "Zone 3", moisture: "50%" }
  ]);

  const [userName, setUserName] = useState({ first: "", last: "" });

  // ✅ Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // ✅ Fetch Admin Name from Firestore
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
            last: data.lastName || ""
          });
        }
      } catch (err) {
        console.error("Error fetching admin name:", err);
      }
    };

    fetchAdminName();
  }, []);

  const handleRemove = (id) => {
    setSoilData(soilData.filter((f) => f.id !== id));
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
          <h4>{userName.first || "Loading..."} {userName.last}</h4>
          <p>Registered Admin</p>
        </div>

        <nav className="f-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/notifications">Notification</NavLink>
          <NavLink to="/farm-group">Farm Group</NavLink>
         
        </nav>

        <button className="rf-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="rf-main">

        <header className="rf-header">
          <h1>Soil Moisture</h1>
        </header>

        <section className="rf-table-section">

          <div className="rf-table-header">
            <span>FIELD NAME</span>
            <span>LOCATION</span>
            <span>MOISTURE LEVEL</span>
            <span>ACTIONS</span>
          </div>

          {soilData.map((f) => (
            <div className="rf-row" key={f.id}>
              <span>{f.field}</span>
              <span>{f.location}</span>
              <span>{f.moisture}</span>

              <div className="f-actions">
                <button className="add">+</button>
                <button
                  className="remove"
                  onClick={() => handleRemove(f.id)}
                >
                  −
                </button>
              </div>
            </div>
          ))}

        </section>
      </main>
    </div>
  );
}