import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./RegisterFarmerPage.css";

export default function RegisterFarmerPage() {
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

  // REMOVE FUNCTION
  const handleRemove = (id) => {
    setFarmers(farmers.filter((farmer) => farmer.id !== id));
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
          <h4>Anne Curtis Smith</h4>
          <p>Registered Admin</p>
        </div>

        <nav className="rf-menu">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/register-farmer" className="active">Register Farmer</Link>
          <Link to="#">Farmers</Link>
          <Link to="#">Soil Moisture Status</Link>
          <Link to="#">Notification</Link>
          <Link to="#">Terms and Conditions</Link>
          <Link to="#">Privacy Policy</Link>
          <Link to="#">Report</Link>
        </nav>

        <button className="rf-logout">Logout</button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="rf-main">
        <header className="rf-header">
          <h1>REGISTER FARMER</h1>
        </header>

        <section className="rf-table-section">
          <div className="rf-table-header">
            <span>FIRST NAME</span>
            <span>LAST NAME</span>
            <span>EMAIL ADDRESS</span>
            <span>ACTIONS</span>
          </div>

          {farmers.map((f) => (
            <div className="rf-row" key={f.id}>
              <span>{f.first}</span>
              <span>{f.last}</span>
              <span>{f.email}</span>
              <div className="rf-actions">
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