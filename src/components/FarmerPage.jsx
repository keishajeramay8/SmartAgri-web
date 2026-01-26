import React from "react";
import { Link } from "react-router-dom";
import "./FarmerPage.css";

export default function FarmerPage() {
  const farmers = [
    { id: 1, first: "Jose", last: "Cruz", email: "jose.cruz@example.com" },
    { id: 2, first: "Maria", last: "Reyes", email: "maria.reyes@example.com" },
    { id: 3, first: "Andres", last: "Santos", email: "a.santos@example.com" },
    { id: 4, first: "Ligaya", last: "Torres", email: "torres.ligaya@example.com" },
    { id: 5, first: "Amihan", last: "Ramos", email: "amihan@example.com" },
    { id: 6, first: "Bayani", last: "Garcia", email: "bayani23@example.com" },
    { id: 7, first: "Lakan", last: "Dela Cruz", email: "lakan@example.com" },
    { id: 8, first: "Pedro", last: "Lopez", email: "lopez.pedro@example.com" },
  ];

  const handleRemove = (id) => {
    alert("Remove functionality for farmer id: " + id);
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
          <h4>Anne Curtis Smith</h4>
          <p>Registered Admin</p>
        </div>

        <nav className="f-menu">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/register-farmer">Register Farmer</Link>
          <Link to="/farmers" className="active">Farmers</Link>
          <Link to="/soil-status">Soil Moisture Status</Link>
          <Link to="/notifications">Notification</Link>
          <Link to="/terms">Terms and Conditions</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/report">Report</Link>
        </nav>

        <button className="f-logout">Logout</button>
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