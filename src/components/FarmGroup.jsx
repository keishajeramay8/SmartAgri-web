// src/components/FarmGroup.jsx
import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaTrash, FaUsers, FaMicrochip, FaEdit, FaLeaf } from "react-icons/fa";
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
  orderBy,
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

  const [deleteDeviceModal, setDeleteDeviceModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGroup, setEditGroup] = useState(null);

  const [unreadCount, setUnreadCount] = useState(0);

  // { [groupId]: { members: number, devices: number } }
  const [groupCounts, setGroupCounts] = useState({});

  // REALTIME UNREAD NOTIFICATIONS COUNT
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const unread = snapshot.docs.filter((d) => !d.data().read).length;
      setUnreadCount(unread);
    });
    return () => unsubscribe();
  }, []);

  // LOGOUT
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // FETCH CURRENT USER
  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUserName({ first: data.firstName || "", last: data.lastName || "" });
      }
    };
    fetchUser();
  }, []);

  // REALTIME FARM GROUPS
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "farmgroups"), where("createdBy", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groups = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setFarmGroups(groups);
    });
    return () => unsubscribe();
  }, []);

  // FETCH MEMBER + DEVICE COUNTS PER GROUP
  useEffect(() => {
    if (farmGroups.length === 0) return;

    const fetchCounts = async () => {
      const counts = {};
      await Promise.all(
        farmGroups.map(async (group) => {
          const [membersSnap, devicesSnap] = await Promise.all([
            getDocs(collection(db, "farmgroups", group.id, "members")),
            getDocs(collection(db, "farmgroups", group.id, "devices")),
          ]);
          counts[group.id] = {
            members: membersSnap.size,
            devices: devicesSnap.size,
          };
        })
      );
      setGroupCounts(counts);
    };

    fetchCounts();
  }, [farmGroups]);
  const getInitials = (first = "", last = "") =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  // CREATE FARM GROUP
  const handleAddFarmGroup = async () => {
    const user = auth.currentUser;
    if (!farmName || !farmCode) {
      alert("Please fill all fields");
      return;
    }
    try {
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
    } catch (error) {
      console.error("Error creating farm group:", error);
      alert("Failed to create farm group. Try again.");
    }
  };

  // OPEN EDIT MODAL
  const handleEdit = (farm) => {
    setEditGroup(farm);
    setEditName(farm.farmgroupName);
    setShowEditModal(true);
  };

  // SAVE EDIT
  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    try {
      await updateDoc(doc(db, "farmgroups", editGroup.id), {
        farmgroupName: editName,
      });
      setShowEditModal(false);
      setEditGroup(null);
    } catch (error) {
      console.error("Edit error:", error);
      alert("Unable to update farm group. Please try again.");
    }
  };

  // OPEN DELETE GROUP MODAL
  const openDeleteGroupModal = (farm) => {
    setSelectedGroup(farm);
    setShowDeleteGroupModal(true);
  };

  // DELETE FARM GROUP
  const handleDelete = async () => {
    if (!selectedGroup) return;
    try {
      await deleteDoc(doc(db, "farmgroups", selectedGroup.id));
      setShowDeleteGroupModal(false);
      setSelectedGroup(null);
    } catch (error) {
      console.error("Error deleting farm group:", error);
      alert("Failed to delete farm group. Try again.");
    }
  };

  // VIEW MEMBERS
  const handleViewMembers = async (group) => {
    setGroupTitle(group.farmgroupName);
    setShowMembersModal(true);
    const membersRef = collection(db, "farmgroups", group.id, "members");
    const snapshot = await getDocs(membersRef);
    const list = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const farmerSnap = await getDoc(doc(db, "users", docSnap.id));
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
        groupId: group.id,
      };
    });
    setDevices(deviceList);
    setShowDeviceModal(true);
  };

  // DELETE DEVICE
  const handleDeleteDevice = async () => {
    if (!selectedDevice) return;
    await deleteDoc(
      doc(db, "farmgroups", selectedDevice.groupId, "devices", selectedDevice.id)
    );
    setDevices(devices.filter((d) => d.id !== selectedDevice.id));
    setDeleteDeviceModal(false);
    setSelectedDevice(null);
  };

  const openDeleteDeviceModal = (device) => {
    setSelectedDevice(device);
    setDeleteDeviceModal(true);
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const cardIcons = ["🌾", "🌱", "🌿", "🍃", "🌻", "🌽"];

  return (
    <div className="fg-dashboard">
      {/* SIDEBAR */}
      <aside className="fg-sidebar">
        <div className="fg-logo">
          <span className="fg-logo-smart">Smart</span>AGRI
        </div>

        <div className="fg-profile">
          <div className="fg-avatar">
            {userName.first
              ? getInitials(userName.first, userName.last)
              : "AD"}
          </div>
          <div>
            <p className="fg-profile-name">
              {userName.first
                ? `${userName.first} ${userName.last}`
                : "Loading..."}
            </p>
            <p className="fg-profile-role">Registered Admin</p>
          </div>
        </div>

        <nav className="fg-nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/notifications">
            <span className="fg-notif-link">
              Notification
              {unreadCount > 0 && (
                <span className="fg-notif-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farm-group" className="active">
            Farm Group
          </NavLink>
        </nav>

        <button className="fg-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <main className="fg-main">
        {/* HEADER */}
        <div className="fg-topbar">
          <div>
            <h1 className="fg-page-title">Farm Groups</h1>
            <p className="fg-page-sub">
              Manage your registered farm groups and their members
            </p>
          </div>
          <button
            className="fg-create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + Create Group
          </button>
        </div>

        {/* STATS */}
        <div className="fg-stats">
          <div className="fg-stat">
            <p className="fg-stat-label">Total Groups</p>
            <p className="fg-stat-val">{farmGroups.length}</p>
          </div>
          <div className="fg-stat">
            <p className="fg-stat-label">Total Members</p>
            <p className="fg-stat-val">
              {Object.values(groupCounts).reduce((sum, c) => sum + (c.members || 0), 0)}
            </p>
          </div>
          <div className="fg-stat">
            <p className="fg-stat-label">Active Devices</p>
            <p className="fg-stat-val">
              {Object.values(groupCounts).reduce((sum, c) => sum + (c.devices || 0), 0)}
            </p>
          </div>
        </div>

        {/* CARDS */}
        <section className="fg-grid">
          {farmGroups.length === 0 && (
            <div className="fg-empty">
              <span className="fg-empty-icon">🌾</span>
              <p>No farm groups yet. Create your first one!</p>
            </div>
          )}

          {farmGroups.map((f, idx) => (
            <div className="fg-card" key={f.id}>
              <div className="fg-card-top">
                <div className="fg-card-icon">
                  {cardIcons[idx % cardIcons.length]}
                </div>
                <span className="fg-code-badge">Code: {f.farmgroupId}</span>
              </div>

              <h3 className="fg-card-name">{f.farmgroupName}</h3>
              <p className="fg-card-date">{formatDate(f.createdAt)}</p>

              <div className="fg-card-counts">
                <span className="fg-count fg-count-members">
                  <span className="fg-dot fg-dot-members" />
                  {groupCounts[f.id]?.members ?? "—"} Members
                </span>
                <span className="fg-count fg-count-devices">
                  <span className="fg-dot fg-dot-devices" />
                  {groupCounts[f.id]?.devices ?? "—"} Devices
                </span>
              </div>

              <div className="fg-card-actions">
                <button
                  className="fg-btn fg-btn-members"
                  onClick={() => handleViewMembers(f)}
                >
                  <FaUsers size={12} /> Members
                </button>
                <button
                  className="fg-btn fg-btn-devices"
                  onClick={() => handleViewDevice(f)}
                >
                  <FaMicrochip size={12} /> Devices
                </button>
                <button
                  className="fg-btn fg-btn-edit"
                  onClick={() => handleEdit(f)}
                >
                  <FaEdit size={12} /> Edit
                </button>
                <button
                  className="fg-btn fg-btn-delete"
                  onClick={() => openDeleteGroupModal(f)}
                >
                  <FaTrash size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div className="fg-overlay">
          <div className="fg-modal">
            <div className="fg-modal-header">
              <h3>Create Farm Group</h3>
              <button
                className="fg-modal-x"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>
            <label className="fg-label">Farm Group Name</label>
            <input
              className="fg-input"
              type="text"
              placeholder="e.g. Maligaya Farmland"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
            />
            <label className="fg-label">Farm Group Code</label>
            <input
              className="fg-input"
              type="text"
              placeholder="e.g. GRP-001"
              value={farmCode}
              onChange={(e) => setFarmCode(e.target.value)}
            />
            <div className="fg-modal-footer">
              <button
                className="fg-modal-cancel"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button className="fg-modal-confirm" onClick={handleAddFarmGroup}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {showEditModal && (
        <div className="fg-overlay">
          <div className="fg-modal">
            <div className="fg-modal-header">
              <h3>Edit Farm Group</h3>
              <button
                className="fg-modal-x"
                onClick={() => setShowEditModal(false)}
              >
                ✕
              </button>
            </div>
            <label className="fg-label">Farm Group Name</label>
            <input
              className="fg-input"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <div className="fg-modal-footer">
              <button
                className="fg-modal-cancel"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button className="fg-modal-confirm" onClick={handleSaveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE GROUP MODAL ── */}
      {showDeleteGroupModal && selectedGroup && (
        <div className="fg-overlay">
          <div className="fg-modal fg-modal-sm">
            <div className="fg-modal-header">
              <h3>Delete Farm Group</h3>
              <button
                className="fg-modal-x"
                onClick={() => setShowDeleteGroupModal(false)}
              >
                ✕
              </button>
            </div>
            <p className="fg-modal-body-text">
              Are you sure you want to delete{" "}
              <strong>{selectedGroup.farmgroupName}</strong>? This action cannot
              be undone.
            </p>
            <div className="fg-modal-footer">
              <button
                className="fg-modal-cancel"
                onClick={() => setShowDeleteGroupModal(false)}
              >
                Cancel
              </button>
              <button className="fg-modal-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MEMBERS MODAL ── */}
      {showMembersModal && (
        <div className="fg-overlay">
          <div className="fg-modal">
            <div className="fg-modal-header">
              <h3>{groupTitle} — Members</h3>
              <button
                className="fg-modal-x"
                onClick={() => setShowMembersModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="fg-list">
              {members.length === 0 && (
                <p className="fg-empty-list">No members found.</p>
              )}
              {members.map((m, i) => (
                <div key={i} className="fg-member-row">
                  <div className="fg-member-avatar">
                    {getInitials(m.firstName, m.lastName)}
                  </div>
                  <span className="fg-member-name">
                    {m.firstName} {m.lastName}
                  </span>
                </div>
              ))}
            </div>
            <div className="fg-modal-footer">
              <button
                className="fg-modal-cancel"
                onClick={() => setShowMembersModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DEVICES MODAL ── */}
      {showDeviceModal && (
        <div className="fg-overlay">
          <div className="fg-modal">
            <div className="fg-modal-header">
              <h3>{groupTitle} — Devices</h3>
              <button
                className="fg-modal-x"
                onClick={() => setShowDeviceModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="fg-list">
              {devices.length === 0 && (
                <p className="fg-empty-list">No devices found.</p>
              )}
              {devices.map((d) => (
                <div key={d.id} className="fg-device-row">
                  <div className="fg-device-info">
                    <p className="fg-device-name">{d.deviceName}</p>
                    <p className="fg-device-id">ID: {d.deviceId}</p>
                  </div>
                  <button
                    className="fg-btn fg-btn-delete"
                    onClick={() => openDeleteDeviceModal(d)}
                  >
                    <FaTrash size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="fg-modal-footer">
              <button
                className="fg-modal-cancel"
                onClick={() => setShowDeviceModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE DEVICE MODAL ── */}
      {deleteDeviceModal && selectedDevice && (
        <div className="fg-overlay">
          <div className="fg-modal fg-modal-sm">
            <div className="fg-modal-header">
              <h3>Delete Device</h3>
              <button
                className="fg-modal-x"
                onClick={() => setDeleteDeviceModal(false)}
              >
                ✕
              </button>
            </div>
            <p className="fg-modal-body-text">
              Are you sure you want to delete{" "}
              <strong>{selectedDevice.deviceName}</strong>?
            </p>
            <div className="fg-modal-footer">
              <button
                className="fg-modal-cancel"
                onClick={() => setDeleteDeviceModal(false)}
              >
                Cancel
              </button>
              <button className="fg-modal-danger" onClick={handleDeleteDevice}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}