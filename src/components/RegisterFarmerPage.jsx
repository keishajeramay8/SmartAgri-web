import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { auth, database } from "../firebase";
import { ref, get } from "firebase/database";
import "./RegisterFarmerPage.css";

export default function RegisterFarmerPage() {
  const [farmers, setFarmers] = useState([
    { id: 1, first: "Jose", last: "Cruz", email: "jose.cruz@example.com" },
    { id: 2, first: "Maria", last: "Reyes", email: "maria.reyes@example.com" },
    { id: 3, first: "Andres", last: "Santos", email: "a.santos@example.com" },
    { id: 4, first: "Ligaya", last: "Torres", email: "torres.ligaya@example.com" },
    { id: 5, first: "Amihan", last: "Ramos", email: "amihan@example.com" },
  ]);

  const [userName, setUserName] = useState({ first: "", last: "" }); // store logged-in user's name

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
          <NavLink to="/register-farmer" className="active">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/soil-status">Soil Moisture Status</NavLink>
          <NavLink to="/notifications">Notification</NavLink>
          <NavLink to="/terms">Terms and Conditions</NavLink>
          <NavLink to="/privacy">Privacy Policy</NavLink>
          <NavLink to="/report">Report</NavLink>
        </nav>

        <button className="f-logout">Logout</button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="f-main">
        <header className="f-header">
          <h1>REGISTER FARMER</h1>
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
