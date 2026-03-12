// src/components/FarmGroup.jsx
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaTrash, FaUsers, FaMicrochip } from "react-icons/fa";
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
  getDoc,
  onSnapshot,
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

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [groupTitle, setGroupTitle] = useState("");

  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [devices, setDevices] = useState([]);

  // LOGOUT
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // FETCH USER
  useEffect(() => {

    const fetchUser = async () => {

      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {

        const data = userSnap.data();

        setUserName({
          first: data.firstName || "",
          last: data.lastName || "",
        });

      }

    };

    fetchUser();

  }, []);

  // REALTIME FARM GROUPS
  useEffect(() => {

    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "farmgroups"),
      where("createdBy", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {

      const groups = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setFarmGroups(groups);

    });

    return () => unsubscribe();

  }, []);

  // CREATE FARM GROUP
  const handleAddFarmGroup = async () => {

    const user = auth.currentUser;

    if (!farmName || !farmCode) {
      alert("Please fill all fields");
      return;
    }

    const codeQuery = query(
      collection(db, "farmgroups"),
      where("farmgroupId", "==", farmCode)
    );

    const codeSnap = await getDocs(codeQuery);

    if (!codeSnap.empty) {
      alert("Farm Group Code already exists");
      return;
    }

    await addDoc(collection(db, "farmgroups"), {
      farmgroupName: farmName,
      farmgroupId: farmCode,
      createdBy: user.uid,
      createdAt: new Date(),
    });

    setFarmName("");
    setFarmCode("");
    setShowCreateModal(false);

  };

  // EDIT
  const handleEdit = async (farm) => {

    const newName = prompt("Edit Farm Group Name", farm.farmgroupName);

    if (!newName) return;

    await updateDoc(doc(db, "farmgroups", farm.id), {
      farmgroupName: newName,
    });

  };

  // DELETE
  const handleDelete = async (id) => {

    if (!window.confirm("Delete this farm group?")) return;

    await deleteDoc(doc(db, "farmgroups", id));

  };

  // VIEW MEMBERS
  const handleViewMembers = async (group) => {

    setGroupTitle(group.farmgroupName);
    setShowMembersModal(true);

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

  };

  // VIEW DEVICES
  const handleViewDevice = async (group) => {

    setGroupTitle(group.farmgroupName);

    const devicesRef = collection(db, "farmgroups", group.id, "devices");
    const snapshot = await getDocs(devicesRef);

    const deviceList = snapshot.docs.map((docSnap) => {

      const data = docSnap.data();

      return {
        id: docSnap.id,
        deviceId: data.deviceId || docSnap.id,
        deviceName: data.deviceName || "Unnamed Device",
      };

    });

    setDevices(deviceList);
    setShowDeviceModal(true);

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

          <h4>
            {userName.first
              ? `${userName.first} ${userName.last}`
              : "Loading..."}
          </h4>

          <p>Registered Admin</p>
        </div>

        <nav className="f-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/notifications">Notification</NavLink>
          <NavLink to="/farm-group" className="active">
            Farm Group
          </NavLink>
           <hr />

        </nav>

        <button className="f-logout" onClick={handleLogout}>
          Logout
        </button>

      </aside>

      {/* MAIN */}
      <main className="f-main">

        <header className="f-header">
          <h1>Farm Group Management</h1>
        </header>

        <button
          className="create-farm-btn"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Farm Group
        </button>

        <section className="farm-card-container">

          <div className="farm-card-grid">

            {farmGroups.map((f) => (

              <div className="farm-card" key={f.id}>

                <div className="farm-title-row">

                  <h3>{f.farmgroupName}</h3>

                  <span className="farm-code-badge">
                    Code: {f.farmgroupId}
                  </span>

                </div>

                <div className="farm-card-actions">

                  <button
                    className="view-btn"
                    onClick={() => handleViewMembers(f)}
                    type="button"
                  >
                    <FaUsers /> Members
                  </button>

                  <button
                    className="device-btn"
                    onClick={() => handleViewDevice(f)}
                    type="button"
                  >
                    <FaMicrochip /> Devices
                  </button>

                  <button
                    className="edit-btn"
                    onClick={() => handleEdit(f)}
                    type="button"
                  >
                    Edit
                  </button>

                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(f.id)}
                    type="button"
                  >
                    <FaTrash />
                  </button>

                </div>

              </div>

            ))}

          </div>

        </section>

      </main>

      {/* MEMBERS MODAL */}
      {showMembersModal && (
        <div className="modal-overlay">
          <div className="modal-box">

            <h3>{groupTitle} Members</h3>

            <div className="member-list">

              {members.length === 0 && <p>No members found</p>}

              {members.map((m, i) => (
                <div key={i} className="member-card">
                  {m.firstName} {m.lastName}
                </div>
              ))}

            </div>

            <button
              className="modal-close-btn"
              onClick={() => setShowMembersModal(false)}
            >
              Close
            </button>

          </div>
        </div>
      )}

      {/* DEVICES MODAL */}
      {showDeviceModal && (
        <div className="modal-overlay">
          <div className="modal-box">

            <h3>{groupTitle} Devices</h3>

            <div className="device-list">

              {devices.length === 0 && <p>No devices found</p>}

              {devices.map((d) => (
                <div key={d.id} className="device-card">
                  <h4>{d.deviceName}</h4>
                  <p>ID: {d.deviceId}</p>
                </div>
              ))}

            </div>

            <button
              className="modal-close-btn"
              onClick={() => setShowDeviceModal(false)}
            >
              Close
            </button>

          </div>
        </div>
      )}

    </div>

  );

}