import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { auth, database } from "../firebase";
import { ref, get } from "firebase/database";
import "./RegisterFarmerPage.css"; // Reuse the same CSS

export default function SoilMoisturePage() {
  // Dummy soil moisture data
  const [soilData, setSoilData] = useState([
    { id: 1, field: "Field A", location: "Zone 1", moisture: "30%" },
    { id: 2, field: "Field B", location: "Zone 2", moisture: "45%" },
    { id: 3, field: "Field C", location: "Zone 3", moisture: "50%" },
    { id: 4, field: "Field D", location: "Zone 4", moisture: "20%" },
    { id: 5, field: "Field E", location: "Zone 5", moisture: "35%" },
  ]);

  const [userName, setUserName] = useState({ first: "", last: "" });

  // Fetch logged-in user's first and last name from Firebase
  useEffect(() => {
    const fetchUserName = async () => {
      const user = auth.currentUser;
      if (user) {
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setUserName({ first: data.firstName, last: data.lastName });
        } else {
          console.log("No user data found.");
        }
      }
    };

    const timeout = setTimeout(fetchUserName, 500);
    return () => clearTimeout(timeout);
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
          <h4>{userName.first} {userName.last}</h4>
          <p>Registered Admin</p>
        </div>

        <nav className="rf-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/soil-status" className="active">Soil Moisture Status</NavLink>
          <NavLink to="/notifications">Notification</NavLink>
          <NavLink to="/terms">Terms and Conditions</NavLink>
          <NavLink to="/privacy">Privacy Policy</NavLink>
          <NavLink to="/report">Report</NavLink>
        </nav>

        <button className="rf-logout">Logout</button>
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
                <button className="remove" onClick={() => handleRemove(f.id)}>−</button>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
