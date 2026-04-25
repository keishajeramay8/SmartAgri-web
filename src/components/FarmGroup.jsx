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
import axios from "axios";
import "./FarmGroup.css";

const GEOAPIFY_KEY = "ceea5600e9214d0cb5719308012683fd";

export default function FarmGroup() {
  const navigate = useNavigate();

  const [farmGroups, setFarmGroups] = useState([]);
  const [userName, setUserName] = useState({ first: "", last: "" });
  const [photoURL, setPhotoURL] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [farmName, setFarmName] = useState("");
  const [farmCode, setFarmCode] = useState("");
  const [farmAddress, setFarmAddress] = useState("");
  const [farmAddressLat, setFarmAddressLat] = useState(null);
  const [farmAddressLon, setFarmAddressLon] = useState(null);
  const [farmAddressSuggestions, setFarmAddressSuggestions] = useState([]);
  const [showFarmAddressSuggestions, setShowFarmAddressSuggestions] = useState(false);
  const [farmAddressError, setFarmAddressError] = useState("");

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
  const [pendingCount, setPendingCount] = useState(0);
  const [groupCounts, setGroupCounts] = useState({});

  const navClass = ({ isActive }) => (isActive ? "active" : undefined);

  // ── Reset create modal fields ──
  const resetCreateModal = () => {
    setFarmName("");
    setFarmCode("");
    setFarmAddress("");
    setFarmAddressLat(null);
    setFarmAddressLon(null);
    setFarmAddressError("");
    setFarmAddressSuggestions([]);
    setShowFarmAddressSuggestions(false);
  };

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

  // FETCH CURRENT USER + PHOTO
  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUserName({ first: data.firstName || "", last: data.lastName || "" });
        setPhotoURL(data.photoURL || "");
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

  // REALTIME PENDING FARMER REQUESTS
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    let unsubscribers = [];
    const setupListeners = async () => {
      try {
        const groupQuery = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );
        const groupSnapshot = await getDocs(groupQuery);
        const countMap = {};
        groupSnapshot.docs.forEach((groupDoc) => {
          const groupId = groupDoc.id;
          countMap[groupId] = 0;
          const joinRef = collection(db, "farmgroups", groupId, "joinRequests");
          const unsub = onSnapshot(joinRef, (snap) => {
            countMap[groupId] = snap.size;
            const total = Object.values(countMap).reduce((a, b) => a + b, 0);
            setPendingCount(total);
          });
          unsubscribers.push(unsub);
        });
      } catch (err) {
        console.error("Error setting up pending count listeners:", err);
      }
    };
    setupListeners();
    return () => unsubscribers.forEach((fn) => fn());
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

  // ADDRESS AUTOCOMPLETE
  const fetchFarmAddressSuggestions = async (input) => {
    try {
      const res = await axios.get("https://api.geoapify.com/v1/geocode/autocomplete", {
        params: { text: input, limit: 5, lang: "en", country: "PH", apiKey: GEOAPIFY_KEY },
      });
      setFarmAddressSuggestions(res.data.features || []);
      setShowFarmAddressSuggestions(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectFarmAddress = (place) => {
    setFarmAddress(place.properties.formatted);
    setFarmAddressLat(place.properties.lat);
    setFarmAddressLon(place.properties.lon);
    setFarmAddressError("");
    setFarmAddressSuggestions([]);
    setShowFarmAddressSuggestions(false);
  };

  // CREATE FARM GROUP
  const handleAddFarmGroup = async () => {
    const user = auth.currentUser;
    if (!farmName || !farmCode) {
      alert("Please fill all fields");
      return;
    }
    if (!farmAddress || !farmAddressLat || !farmAddressLon) {
      setFarmAddressError("Please select a Philippine address");
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
        farmAddress: farmAddress,
        farmLat: farmAddressLat,
        farmLon: farmAddressLon,
        createdBy: user.uid,
        createdAt: new Date(),
      });
      resetCreateModal();
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating farm group:", error);
      alert("Failed to create farm group. Try again.");
    }
  };

  const handleEdit = (farm) => {
    setEditGroup(farm);
    setEditName(farm.farmgroupName);
    setShowEditModal(true);
  };

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

  const openDeleteGroupModal = (farm) => {
    setSelectedGroup(farm);
    setShowDeleteGroupModal(true);
  };

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
            {photoURL
              ? <img src={photoURL} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : (userName.first ? getInitials(userName.first, userName.last) : "AD")
            }
          </div>
          <div>
            <p className="fg-profile-name">
              {userName.first ? `${userName.first} ${userName.last}` : "Loading..."}
            </p>
            <p className="fg-profile-role">Registered Admin</p>
          </div>
        </div>

        <nav className="fg-nav">
          <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
          <NavLink to="/register-farmer" className={navClass}>
            <span className="fg-notif-link">
              Register Farmer
              {pendingCount > 0 && (
                <span className="fg-notif-badge">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farmers" className={navClass}>Farmers</NavLink>
          <NavLink to="/notifications" className={navClass}>
            <span className="fg-notif-link">
              Notification
              {unreadCount > 0 && (
                <span className="fg-notif-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farm-group" className={navClass}>Farm Group</NavLink>
          <NavLink to="/profile" className={navClass}>Profile</NavLink>
        </nav>

        <button className="fg-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <main className="fg-main">
        <div className="fg-topbar">
          <div>
            <h1 className="fg-page-title">FARM GROUPS</h1>
            <p className="fg-page-sub">
              Manage your registered farm groups and their members
            </p>
          </div>
          <button
            className="fg-create-btn"
            onClick={() => {
              resetCreateModal();
              setShowCreateModal(true);
            }}
          >
            + Create Group
          </button>
        </div>

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

              {f.farmAddress && (
                <p className="fg-card-address">📍 {f.farmAddress}</p>
              )}

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
                <button className="fg-btn fg-btn-members" onClick={() => handleViewMembers(f)}>
                  <FaUsers size={12} /> Members
                </button>
                <button className="fg-btn fg-btn-devices" onClick={() => handleViewDevice(f)}>
                  <FaMicrochip size={12} /> Devices
                </button>
                <button className="fg-btn fg-btn-edit" onClick={() => handleEdit(f)}>
                  <FaEdit size={12} /> Edit
                </button>
                <button className="fg-btn fg-btn-delete" onClick={() => openDeleteGroupModal(f)}>
                  <FaTrash size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div className="fg-overlay" onClick={(e) => { if (e.target === e.currentTarget) { resetCreateModal(); setShowCreateModal(false); } }}>
          <div className="fg-modal">
            <div className="fg-modal-header">
              <h3>Create Farm Group</h3>
              <button className="fg-modal-x" onClick={() => { resetCreateModal(); setShowCreateModal(false); }}>✕</button>
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

            <label className="fg-label">Farm Address</label>
            <div style={{ position: "relative" }}>
              <input
                className="fg-input"
                type="text"
                placeholder="Enter farm location"
                value={farmAddress}
                autoComplete="off"
                style={{ borderColor: farmAddressError ? "#E63462" : "" }}
                onChange={(e) => {
                  setFarmAddress(e.target.value);
                  setFarmAddressLat(null);
                  setFarmAddressLon(null);
                  if (farmAddressError) setFarmAddressError("");
                  if (e.target.value) fetchFarmAddressSuggestions(e.target.value);
                  else {
                    setFarmAddressSuggestions([]);
                    setShowFarmAddressSuggestions(false);
                  }
                }}
              />
              {showFarmAddressSuggestions && farmAddressSuggestions.length > 0 && (
                <ul className="fg-suggestions-list">
                  {farmAddressSuggestions.map((item) => (
                    <li
                      key={item.properties.place_id}
                      onClick={() => handleSelectFarmAddress(item)}
                    >
                      {item.properties.formatted}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {farmAddressError && (
              <span className="fg-address-error">{farmAddressError}</span>
            )}

            <div className="fg-modal-footer">
              <button className="fg-modal-cancel" onClick={() => { resetCreateModal(); setShowCreateModal(false); }}>Cancel</button>
              <button className="fg-modal-confirm" onClick={handleAddFarmGroup}>Create</button>
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
              <button className="fg-modal-x" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <label className="fg-label">Farm Group Name</label>
            <input
              className="fg-input"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <div className="fg-modal-footer">
              <button className="fg-modal-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="fg-modal-confirm" onClick={handleSaveEdit}>Save</button>
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
              <button className="fg-modal-x" onClick={() => setShowDeleteGroupModal(false)}>✕</button>
            </div>
            <p className="fg-modal-body-text">
              Are you sure you want to delete{" "}
              <strong>{selectedGroup.farmgroupName}</strong>? This action cannot be undone.
            </p>
            <div className="fg-modal-footer">
              <button className="fg-modal-cancel" onClick={() => setShowDeleteGroupModal(false)}>Cancel</button>
              <button className="fg-modal-danger" onClick={handleDelete}>Delete</button>
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
              <button className="fg-modal-x" onClick={() => setShowMembersModal(false)}>✕</button>
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
              <button className="fg-modal-cancel" onClick={() => setShowMembersModal(false)}>Close</button>
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
              <button className="fg-modal-x" onClick={() => setShowDeviceModal(false)}>✕</button>
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
                  <button className="fg-btn fg-btn-delete" onClick={() => openDeleteDeviceModal(d)}>
                    <FaTrash size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="fg-modal-footer">
              <button className="fg-modal-cancel" onClick={() => setShowDeviceModal(false)}>Close</button>
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
              <button className="fg-modal-x" onClick={() => setDeleteDeviceModal(false)}>✕</button>
            </div>
            <p className="fg-modal-body-text">
              Are you sure you want to delete{" "}
              <strong>{selectedDevice.deviceName}</strong>?
            </p>
            <div className="fg-modal-footer">
              <button className="fg-modal-cancel" onClick={() => setDeleteDeviceModal(false)}>Cancel</button>
              <button className="fg-modal-danger" onClick={handleDeleteDevice}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}