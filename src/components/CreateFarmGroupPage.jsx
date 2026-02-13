import React, { useState, useEffect } from "react";
import { auth, database } from "../firebase";
import { ref, get, push, set, remove, update } from "firebase/database";
import { Link } from "react-router-dom";
import "./CreateFarmGroupPage.css";

export default function CreateFarmGroupPage() {
  const [farmGroups, setFarmGroups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [editGroup, setEditGroup] = useState(null); // Track group being edited
  const [adminName, setAdminName] = useState({ first: "", last: "" }); // Admin name

  // Fetch admin's name from Firebase
  useEffect(() => {
    const fetchAdminName = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = ref(database, `users/${user.uid}`);
      try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setAdminName({ first: data.firstName || "", last: data.lastName || "" });
        }
      } catch (error) {
        console.error("Error fetching admin name:", error);
      }
    };

    const timeout = setTimeout(fetchAdminName, 500); // slight delay to ensure auth is ready
    return () => clearTimeout(timeout);
  }, []);

  // Fetch farm groups safely
  useEffect(() => {
    const fetchFarmGroups = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const groupsRef = ref(database, `farmGroups/${user.uid}`);
      try {
        const snapshot = await get(groupsRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const list = Object.keys(data).map((key) => ({
            id: key,
            code: data[key].code,
            name: data[key].name,
          }));
          setFarmGroups(list);
        }
      } catch (error) {
        console.error("Error fetching farm groups:", error);
      }
    };

    fetchFarmGroups();
  }, []);

  // Add or Edit farm group
  const handleAddEditFarmGroup = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !newCode || !newName) return;

    if (editGroup) {
      // Editing existing group
      const groupRef = ref(database, `farmGroups/${user.uid}/${editGroup.id}`);
      await update(groupRef, { code: newCode, name: newName });
      setFarmGroups(
        farmGroups.map((group) =>
          group.id === editGroup.id ? { ...group, code: newCode, name: newName } : group
        )
      );
      setEditGroup(null);
    } else {
      // Adding new group
      const groupsRef = ref(database, `farmGroups/${user.uid}`);
      const newGroupRef = push(groupsRef);
      await set(newGroupRef, { code: newCode, name: newName });
      setFarmGroups([...farmGroups, { id: newGroupRef.key, code: newCode, name: newName }]);
    }

    setNewCode("");
    setNewName("");
    setShowForm(false);
  };

  // Edit button
  const handleEdit = (group) => {
    setEditGroup(group);
    setNewCode(group.code);
    setNewName(group.name);
    setShowForm(true);
  };

  // Delete button
  const handleDelete = async (id) => {
    const user = auth.currentUser;
    if (!user) return;

    if (!window.confirm("Are you sure you want to delete this farm group?")) return;

    const groupRef = ref(database, `farmGroups/${user.uid}/${id}`);
    await remove(groupRef);
    setFarmGroups(farmGroups.filter((group) => group.id !== id));
  };

  return (
    <div className="dashboard">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="logo">
          <span className="italic">Smart</span>AGRI
        </h2>

        <div className="profile">
          <div className="avatar"></div>
          <h4>{adminName.first} {adminName.last}</h4>
          <span className="role">Registered Admin</span>
        </div>

        <nav className="menu">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/register-farmer">Register Farmer</Link>
          <Link to="/farmers">Farmers</Link>
          <Link to="/soil-status">Soil Moisture Status</Link>
          <Link to="/notifications">Notification</Link>
          <Link to="/terms">Terms and Conditions</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/report">Report</Link>
        </nav>

        <button className="logout">Logout</button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        <header className="header">
          <div>
            <h1>Farm Groups</h1>
            <p>Manage your farm groups here.</p>
          </div>

          <div className="header-right">
            <button className="farm-group-btn" onClick={() => setShowForm(true)}>
              + Add Farm Group
            </button>
          </div>
        </header>

        {/* List of farm groups */}
        <div className="farmgroup-list">
          {farmGroups.length === 0 ? (
            <p>No farm groups created yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Farm Group Code</th>
                  <th>Farm Group Name</th>
                </tr>
              </thead>
              <tbody>
                {farmGroups.map((group) => (
                  <tr key={group.id}>
                    <td>{group.code}</td>
                    <td>
                      <div className="group-name-container">
                        <span className="group-name-text">{group.name}</span>
                        <div>
                          <button className="edit-btn" onClick={() => handleEdit(group)}>Edit</button>
                          <button className="delete-btn" onClick={() => handleDelete(group.id)}>Delete</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Popup form */}
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
                  <button type="submit" className="submit-btn">
                    {editGroup ? "Save" : "Add"}
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => { setShowForm(false); setEditGroup(null); }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
