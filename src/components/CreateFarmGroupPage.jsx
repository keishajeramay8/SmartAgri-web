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

  // ✅ Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // ✅ Fetch Admin Name (CORRECT VERSION)
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
                </tr>
              </thead>
              <tbody>
                {farmGroups.map((group) => (
                  <tr key={group.id}>
                    <td>{group.farmgroupCode}</td>
                    <td>
                      <div className="group-name-container">
                        <span className="group-name-text">
                          {group.farmgroupName}
                        </span>

                        <div>
                          <button
                            className="edit-btn"
                            onClick={() => handleEdit(group)}
                          >
                            Edit
                          </button>

                          <button
                            className="delete-btn"
                            onClick={() => handleDelete(group.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showForm && (
          <div className="popup">
            <div className="popup-content">
              <h3>
                {editGroup ? "Edit Farm Group" : "Add New Farm Group"}
              </h3>

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
      </main>
    </div>
  );
}