// src/components/CreateFarmGroupPage.jsx
import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  getDoc
} from "firebase/firestore";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import "./CreateFarmGroupPage.css";

export default function CreateFarmGroupPage() {
  const navigate = useNavigate();

  const [farmGroups, setFarmGroups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [editGroup, setEditGroup] = useState(null);
  const [adminName, setAdminName] = useState({ first: "", last: "" });

  // New states for popup
  const [viewMembersGroup, setViewMembersGroup] = useState(null);
  const [viewDeviceGroup, setViewDeviceGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [device, setDevice] = useState({ deviceId: "", deviceName: "" });

  // ✅ Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // ✅ Fetch Admin Name
  useEffect(() => {
    const fetchAdminName = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setAdminName({
            first: data.firstName || "",
            last: data.lastName || ""
          });
        }
      } catch (error) {
        console.error("Error fetching admin name:", error);
      }
    };

    fetchAdminName();
  }, []);

  // ✅ Fetch Farm Groups created by this admin
  useEffect(() => {
    const fetchFarmGroups = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const q = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );

        const snapshot = await getDocs(q);

        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        setFarmGroups(list);
      } catch (error) {
        console.error("Error fetching farm groups:", error);
      }
    };

    fetchFarmGroups();
  }, []);

  // ✅ Add or Edit Farm Group
  const handleAddEditFarmGroup = async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user || !newCode || !newName) return;

    try {
      if (editGroup) {
        const groupRef = doc(db, "farmgroups", editGroup.id);

        await updateDoc(groupRef, {
          farmgroupCode: newCode,
          farmgroupName: newName
        });

        setFarmGroups(
          farmGroups.map((group) =>
            group.id === editGroup.id
              ? { ...group, farmgroupCode: newCode, farmgroupName: newName }
              : group
          )
        );

        setEditGroup(null);
      } else {
        const newDoc = await addDoc(collection(db, "farmgroups"), {
          farmgroupCode: newCode,
          farmgroupName: newName,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });

        setFarmGroups([
          ...farmGroups,
          {
            id: newDoc.id,
            farmgroupCode: newCode,
            farmgroupName: newName,
            createdBy: user.uid
          }
        ]);
      }

      setNewCode("");
      setNewName("");
      setShowForm(false);
    } catch (error) {
      console.error("Error adding/editing farm group:", error);
    }
  };

  const handleEdit = (group) => {
    setEditGroup(group);
    setNewCode(group.farmgroupCode);
    setNewName(group.farmgroupName);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this farm group?"))
      return;

    try {
      await deleteDoc(doc(db, "farmgroups", id));
      setFarmGroups(farmGroups.filter((group) => group.id !== id));
    } catch (error) {
      console.error("Error deleting farm group:", error);
    }
  };

  // ✅ View Members of a Farm Group
  const handleViewMembers = async (group) => {
    try {
      const membersCol = collection(db, "farmers"); // Assuming all farmers
      const q = query(membersCol, where("farmGroupId", "==", group.id));
      const snapshot = await getDocs(q);

      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      setMembers(list);
      setViewMembersGroup(group);
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const handleViewDevice = async (group) => {
    try {
      if (!group.deviceId) {
        setDevice({ deviceId: "No Device", deviceName: "N/A" });
      } else {
        const deviceDoc = await getDoc(doc(db, "devices", group.deviceId));
        if (deviceDoc.exists()) {
          setDevice({
            deviceId: deviceDoc.id,
            deviceName: deviceDoc.data().deviceName || "Unnamed Device"
          });
        } else {
          setDevice({ deviceId: group.deviceId, deviceName: "Unknown Device" });
        }
      }
      setViewDeviceGroup(group);
    } catch (error) {
      console.error("Error fetching device:", error);
    }
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2 className="logo">
          <span className="italic">Smart</span>AGRI
        </h2>

        <div className="profile">
          <div className="avatar"></div>
          <h4>
            {adminName.first || "Loading..."} {adminName.last}
          </h4>
          <span className="role">Registered Admin</span>
        </div>

       <nav className="f-menu">
  <NavLink to="/dashboard">Dashboard</NavLink>
  <NavLink to="/register-farmer">Register Farmer</NavLink>
  <NavLink to="/farmers">Farmers</NavLink>
  <NavLink to="/soil-status">Soil Moisture Status</NavLink>
  <NavLink to="/notifications">Notification</NavLink>
</nav>

        <button className="logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <h1>Farm Groups</h1>
            <p>Manage your farm groups here.</p>
          </div>

          <div className="header-right">
            <button
              className="farm-group-btn"
              onClick={() => setShowForm(true)}
            >
              + Add Farm Group
            </button>
          </div>
        </header>

        <div className="farmgroup-list">
          {farmGroups.length === 0 ? (
            <p>No farm groups created yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Farm Group Code</th>
                  <th>Farm Group Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {farmGroups.map((group) => (
                  <tr key={group.id}>
                    <td>{group.farmgroupCode}</td>
                    <td>{group.farmgroupName}</td>
                    <td>
                      <button className="edit-btn" onClick={() => handleEdit(group)}>Edit</button>
                      <button className="delete-btn" onClick={() => handleDelete(group.id)}>Delete</button>
                      <button className="view-btn" onClick={() => handleViewMembers(group)}>View Members</button>
                      <button className="view-btn" onClick={() => handleViewDevice(group)}>View Device</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add/Edit Farm Group Form */}
        {showForm && (
          <div className="popup">
            <div className="popup-content">
              <h3>{editGroup ? "Edit Farm Group" : "Add New Farm Group"}</h3>

              <form onSubmit={handleAddEditFarmGroup}>
                <input
                  type="text"
                  placeholder="Farm Group Code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Farm Group Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />

                <div className="form-buttons">
                  <button type="submit" className="submit-btn">{editGroup ? "Save" : "Add"}</button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setShowForm(false);
                      setEditGroup(null);
                      setNewCode("");
                      setNewName("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Members Popup */}
        {viewMembersGroup && (
          <div className="popup">
            <div className="popup-content">
              <h3>Members of {viewMembersGroup.farmgroupName}</h3>
              {members.length === 0 ? (
                <p>No members in this farm group.</p>
              ) : (
                <ul>
                  {members.map((m) => (
                    <li key={m.id}>{m.firstName} {m.lastName}</li>
                  ))}
                </ul>
              )}
              <button className="cancel-btn" onClick={() => setViewMembersGroup(null)}>Close</button>
            </div>
          </div>
        )}

        {/* Device Popup */}
        {viewDeviceGroup && (
          <div className="popup">
            <div className="popup-content">
              <h3>Device for {viewDeviceGroup.farmgroupName}</h3>
              <p><strong>Device Name:</strong> {device.deviceName}</p>
              <p><strong>Device ID:</strong> {device.deviceId}</p>
              <button className="cancel-btn" onClick={() => setViewDeviceGroup(null)}>Close</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}