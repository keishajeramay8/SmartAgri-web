// src/components/FarmGroup.jsx
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaTrash } from "react-icons/fa";
import { auth, db } from "../firebase";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDoc
} from "firebase/firestore";

import { signOut } from "firebase/auth";
import "./FarmGroup.css";

export default function FarmGroup() {

  const navigate = useNavigate();

  const [farmGroups, setFarmGroups] = useState([]);
  const [userName, setUserName] = useState({ first: "", last: "" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [farmName, setFarmName] = useState("");
  const [farmCode, setFarmCode] = useState("");

  // For members popup
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [groupTitle, setGroupTitle] = useState("");

  // For device popup
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [device, setDevice] = useState({ deviceId: "", deviceName: "" });

  // ===============================
  // Logout
  // ===============================
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // ===============================
  // Fetch User Info
  // ===============================
  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const snap = await getDocs(
          query(collection(db, "users"), where("uid", "==", user.uid))
        );

        if (!snap.empty) {
          const data = snap.docs[0].data();
          setUserName({
            first: data.firstName || "",
            last: data.lastName || ""
          });
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchUser();
  }, []);

  // ===============================
  // Fetch FarmGroups
  // ===============================
  const fetchFarmGroups = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "farmgroups"),
      where("createdBy", "==", user.uid)
    );

    const snapshot = await getDocs(q);

    setFarmGroups(
      snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    );
  };

  useEffect(() => {
    fetchFarmGroups();
  }, []);

  // ===============================
  // Create Farm Group
  // ===============================
  const handleAddFarmGroup = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!farmName || !farmCode) {
      alert("Please fill all fields");
      return;
    }

    const codeQuery = query(
      collection(db, "farmgroups"),
      where("farmgroupCode", "==", farmCode)
    );

    const codeSnap = await getDocs(codeQuery);

    if (!codeSnap.empty) {
      alert("Farm Group Code already exists!");
      return;
    }

    await addDoc(collection(db, "farmgroups"), {
      farmgroupName: farmName,
      farmgroupCode: farmCode,
      createdBy: user.uid,
      createdAt: new Date()
    });

    setFarmName("");
    setFarmCode("");
    setShowCreateModal(false);

    fetchFarmGroups();
  };

  // ===============================
  // Edit FarmGroup
  // ===============================
  const handleEdit = async (farm) => {
    const newName = prompt(
      "Edit Farm Group Name:",
      farm.farmgroupName
    );
    if (!newName) return;

    await updateDoc(
      doc(db, "farmgroups", farm.id),
      { farmgroupName: newName }
    );

    fetchFarmGroups();
  };

  // ===============================
  // Delete FarmGroup
  // ===============================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this farm group?")) return;

    await deleteDoc(doc(db, "farmgroups", id));

    fetchFarmGroups();
  };

  // ===============================
  // View Members
  // ===============================
  const handleViewMembers = async (group) => {
    setGroupTitle(group.farmgroupName);
    setShowMembersModal(true);

    try {
      const membersRef = collection(db, "farmgroups", group.id, "members");
      const snapshot = await getDocs(membersRef);

      const list = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const farmerUid = docSnap.id;
          const farmerSnap = await getDoc(doc(db, "users", farmerUid));
          return farmerSnap.exists() ? farmerSnap.data() : null;
        })
      );

      setMembers(list.filter(Boolean));
    } catch (error) {
      console.error(error);
    }
  };

  // ===============================
  // View Device
  // ===============================
  const handleViewDevice = async (group) => {
    try {
      if (!group.deviceId) {
        setDevice({ deviceId: "No Device", deviceName: "N/A" });
      } else {
        const deviceSnap = await getDoc(doc(db, "devices", group.deviceId));
        if (deviceSnap.exists()) {
          setDevice({
            deviceId: deviceSnap.id,
            deviceName: deviceSnap.data().deviceName || "Unnamed Device"
          });
        } else {
          setDevice({ deviceId: group.deviceId, deviceName: "Unknown Device" });
        }
      }
      setShowDeviceModal(true);
    } catch (error) {
      console.error(error);
    }
  };

  // ===============================
  // UI
  // ===============================
  return (
    <div className="f-dashboard">

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
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/soil-status">Soil Moisture Status</NavLink>
          <NavLink to="/notifications">Notification</NavLink>
          <NavLink to="/farm-group" className="active">Farm Group</NavLink>
        </nav>

        <button className="f-logout" onClick={handleLogout}>Logout</button>
      </aside>

      <main className="f-main">
        <header className="f-header">
          <h1>FARM GROUP MANAGEMENT</h1>
        </header>

        {/* Create Button */}
        <button className="create-farm-btn" onClick={() => setShowCreateModal(true)}>
          + Create Farm Group
        </button>

        {/* Farm Cards */}
        <section className="farm-card-container">
          <div className="farm-card-grid">
            {farmGroups.map(f => (
              <div className="farm-card" key={f.id}>
                <h3>{f.farmgroupName}</h3>
                <p className="farm-code">Code: {f.farmgroupCode}</p>

                <div className="farm-card-actions">
                  <button className="view-btn" onClick={() => handleViewMembers(f)}>
                    View Members
                  </button>

                  <button className="view-btn" onClick={() => handleViewDevice(f)}>
                    View Device
                  </button>

                  <button className="edit-btn" onClick={() => handleEdit(f)}>Edit</button>

                  <button className="delete-btn" onClick={() => handleDelete(f.id)}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Create Farm Group</h3>

            <input
              placeholder="Farm Group Name"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
            />

            <input
              placeholder="Farm Group Code"
              value={farmCode}
              onChange={(e) => setFarmCode(e.target.value)}
            />

            <div className="modal-actions">
              <button className="view-btn" onClick={handleAddFarmGroup}>Create</button>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBERS MODAL */}
      {showMembersModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Members of {groupTitle}</h3>
            {members.length === 0 ? (
              <p>No members in this farm group.</p>
            ) : (
              <ul>
                {members.map((m, i) => (
                  <li key={i}>{m.firstName} {m.lastName}</li>
                ))}
              </ul>
            )}
            <button className="modal-close-btn" onClick={() => setShowMembersModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* DEVICE MODAL */}
      {showDeviceModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Device Info</h3>
            <p><strong>Device Name:</strong> {device.deviceName}</p>
            <p><strong>Device ID:</strong> {device.deviceId}</p>
            <button className="modal-close-btn" onClick={() => setShowDeviceModal(false)}>Close</button>
          </div>
        </div>
      )}

    </div>
  );
}