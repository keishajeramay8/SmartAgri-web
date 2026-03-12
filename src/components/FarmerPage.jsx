import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaTrash } from "react-icons/fa";

import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where
} from "firebase/firestore";

import { signOut } from "firebase/auth";
import "./FarmerPage.css";

export default function FarmerPage() {

  const navigate = useNavigate();

  const [farmers, setFarmers] = useState([]);
  const [userName, setUserName] = useState({ first: "", last: "" });

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFarmer, setEditFarmer] = useState(null);

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // =============================
  // Logout
  // =============================
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // =============================
  // Fetch Admin Name
  // =============================
  useEffect(() => {

    const fetchAdminName = async () => {

      const user = auth.currentUser;
      if (!user) return;

      const snap = await getDoc(
        doc(db, "users", user.uid)
      );

      if (snap.exists()) {
        const data = snap.data();

        setUserName({
          first: data.firstName || "",
          last: data.lastName || ""
        });
      }
    };

    fetchAdminName();

  }, []);

  // =============================
  // Fetch Farmers (Members Collection)
  // =============================
  useEffect(() => {

    const loadFarmers = async () => {

      const user = auth.currentUser;
      if (!user) return;

      try {

        const groupQuery = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );

        const groupSnapshot = await getDocs(groupQuery);

        let farmerList = [];

        for (const groupDoc of groupSnapshot.docs) {

          const groupId = groupDoc.id;

          const membersRef = collection(
            db,
            "farmgroups",
            groupId,
            "members"
          );

          const memberSnapshot = await getDocs(membersRef);

          const farmers = await Promise.all(
            memberSnapshot.docs.map(async (memberDoc) => {

              const farmerUid = memberDoc.id;

              const farmerSnap = await getDoc(
                doc(db, "users", farmerUid)
              );

              return {
                id: farmerUid,
                groupId,
                ...(farmerSnap.exists()
                  ? farmerSnap.data()
                  : {})
              };

            })
          );

          farmerList = [...farmerList, ...farmers];
        }

        setFarmers(farmerList);

      } catch (error) {
        console.error(error);
      }
    };

    loadFarmers();

  }, []);

  // =============================
  // Remove Farmer
  // =============================
  const handleRemove = async (farmer) => {

    if (!window.confirm("Remove this farmer?")) return;

    try {

      await deleteDoc(
        doc(
          db,
          "farmgroups",
          farmer.groupId,
          "members",
          farmer.id
        )
      );

      setFarmers(prev =>
        prev.filter(f => f.id !== farmer.id)
      );

      alert("Farmer removed.");

    } catch (error) {
      console.error(error);
    }
  };

  // =============================
  // Edit Farmer Modal Open
  // =============================
  const handleEditClick = (farmer) => {

    setEditFarmer(farmer);

    setEditFirstName(farmer.firstName || "");
    setEditLastName(farmer.lastName || "");
    setEditEmail(farmer.email || "");

    setShowEditModal(true);
  };

  // =============================
  // Update Farmer Profile
  // =============================
  const handleUpdateFarmer = async () => {

    if (!editFarmer) return;

    try {

      await updateDoc(
        doc(db, "users", editFarmer.id),
        {
          firstName: editFirstName,
          lastName: editLastName,
          email: editEmail
        }
      );

      setFarmers(prev =>
        prev.map(f =>
          f.id === editFarmer.id
            ? {
                ...f,
                firstName: editFirstName,
                lastName: editLastName,
                email: editEmail
              }
            : f
        )
      );

      alert("Farmer updated.");
      setShowEditModal(false);

    } catch (error) {
      console.error(error);
    }
  };

  // =============================
  // UI Render
  // =============================
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
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers" className="active">
            Farmers
          </NavLink>
          <NavLink to="/notifications">Notification</NavLink>
          <NavLink to="/farm-group">Farm Group</NavLink>
                    <hr />

        </nav>

        <button className="f-logout" onClick={handleLogout}>
          Logout
        </button>

      </aside>

      {/* MAIN */}
      <main className="f-main">

        <header className="f-header">
          <h1>Farmer Management</h1>
        </header>

        <section className="f-table-section">

          <div className="f-table-header">
            <span>FIRST NAME</span>
            <span>LAST NAME</span>
            <span>EMAIL ADDRESS</span>
            <span>ACTIONS</span>
          </div>

          {farmers.length === 0 ? (
            <p style={{ textAlign: "center", marginTop: "20px" }}>
              No farmers have joined this farmgroup yet.
            </p>
          ) : (

            farmers.map((f) => (

              <div className="f-row" key={f.id}>

                <span>{f.firstName || ""}</span>
                <span>{f.lastName || ""}</span>
                <span>{f.email || ""}</span>

              <div className="f-actions">

  <button
    className="edit-icon"
    onClick={() => handleEditClick(f)}
  >
    Edit
  </button>

  <button
    className="remove-btn"
    onClick={() => handleRemove(f)}
  >
    Remove
  </button>

</div>

              </div>

            ))

          )}

        </section>
      </main>

      {/* ================= EDIT MODAL ================= */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-box">

            <h3>Edit Farmer</h3>

            <input
              type="text"
              placeholder="First Name"
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
            />

            <input
              type="text"
              placeholder="Last Name"
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
            />

            <input
              type="email"
              placeholder="Email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />

            <div className="modal-actions">
              <button className="modal-create-btn" onClick={handleUpdateFarmer}>
                Save
              </button>

              <button
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}