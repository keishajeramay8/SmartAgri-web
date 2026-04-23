import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaTrash, FaEdit } from "react-icons/fa";

import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";

import { signOut } from "firebase/auth";
import "./FarmerPage.css";

export default function FarmerPage() {
  const navigate = useNavigate();

  const [farmers, setFarmers] = useState([]);
  const [farmGroupNames, setFarmGroupNames] = useState({});
  const [userName, setUserName] = useState({ first: "", last: "" });
  const [photoURL, setPhotoURL] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0); // ← NEW

  const [showEditModal, setShowEditModal] = useState(false);
  const [editFarmer, setEditFarmer] = useState(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  const [search, setSearch] = useState("");

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Fetch Admin Name + Photo
  useEffect(() => {
    const fetchAdminName = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserName({ first: data.firstName || "", last: data.lastName || "" });
        setPhotoURL(data.photoURL || "");
      }
    };
    fetchAdminName();
  }, []);

  // Real-time Unread Notifications Count
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

  // ─── Realtime Pending Farmer Requests ───
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

  // Fetch Farmers
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
        const namesMap = {};

        for (const groupDoc of groupSnapshot.docs) {
          const groupId = groupDoc.id;
          const groupData = groupDoc.data();
          namesMap[groupId] = groupData.farmgroupName || "Unnamed Group";

          const membersRef = collection(db, "farmgroups", groupId, "members");
          const memberSnapshot = await getDocs(membersRef);

          const farmers = await Promise.all(
            memberSnapshot.docs.map(async (memberDoc) => {
              const farmerUid = memberDoc.id;
              const farmerSnap = await getDoc(doc(db, "users", farmerUid));
              return {
                id: farmerUid,
                groupId,
                ...(farmerSnap.exists() ? farmerSnap.data() : {}),
              };
            })
          );
          farmerList = [...farmerList, ...farmers];
        }

        setFarmGroupNames(namesMap);
        setFarmers(farmerList);
      } catch (error) {
        console.error(error);
      }
    };
    loadFarmers();
  }, []);

  const openRemoveModal = (farmer) => {
    setSelectedFarmer(farmer);
    setShowRemoveModal(true);
  };

  const handleRemove = async () => {
    if (!selectedFarmer) return;
    try {
      await deleteDoc(
        doc(db, "farmgroups", selectedFarmer.groupId, "members", selectedFarmer.id)
      );
      setFarmers((prev) => prev.filter((f) => f.id !== selectedFarmer.id));
      setShowRemoveModal(false);
      setSelectedFarmer(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditClick = (farmer) => {
    setEditFarmer(farmer);
    setEditFirstName(farmer.firstName || "");
    setEditLastName(farmer.lastName || "");
    setEditEmail(farmer.email || "");
    setShowEditModal(true);
  };

  const handleUpdateFarmer = async () => {
    if (!editFarmer) return;
    try {
      await updateDoc(doc(db, "users", editFarmer.id), {
        firstName: editFirstName,
        lastName: editLastName,
        email: editEmail,
      });
      setFarmers((prev) =>
        prev.map((f) =>
          f.id === editFarmer.id
            ? { ...f, firstName: editFirstName, lastName: editLastName, email: editEmail }
            : f
        )
      );
      setShowEditModal(false);
    } catch (error) {
      console.error(error);
    }
  };

  const getInitials = (first = "", last = "") =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  const filtered = farmers.filter((f) => {
    const term = search.toLowerCase();
    const groupName = (farmGroupNames[f.groupId] || "").toLowerCase();
    return (
      (f.firstName || "").toLowerCase().includes(term) ||
      (f.lastName || "").toLowerCase().includes(term) ||
      (f.email || "").toLowerCase().includes(term) ||
      groupName.includes(term)
    );
  });

  const navClass = ({ isActive }) => (isActive ? "active" : undefined);

  return (
    <div className="fp-dashboard">
      {/* SIDEBAR */}
      <aside className="fp-sidebar">
        <div className="fp-logo">
          <span className="fp-logo-smart">Smart</span>AGRI
        </div>

        <div className="fp-profile">
          <div className="fp-avatar">
            {photoURL
              ? <img src={photoURL} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : (userName.first ? getInitials(userName.first, userName.last) : "AD")
            }
          </div>
          <div>
            <p className="fp-profile-name">
              {userName.first ? `${userName.first} ${userName.last}` : "Loading..."}
            </p>
            <p className="fp-profile-role">Registered Admin</p>
          </div>
        </div>

        <nav className="fp-nav">
          <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
          <NavLink to="/register-farmer" className={navClass}>
            <span className="fp-notif-link">
              Register Farmer
              {pendingCount > 0 && (
                <span className="fp-notif-badge">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farmers" className={navClass}>Farmers</NavLink>
          <NavLink to="/notifications" className={navClass}>
            <span className="fp-notif-link">
              Notification
              {unreadCount > 0 && (
                <span className="fp-notif-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farm-group" className={navClass}>Farm Group</NavLink>
          <NavLink to="/profile" className={navClass}>Profile</NavLink>
        </nav>

        <button className="fp-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <main className="fp-main">
        <div className="fp-topbar">
          <div>
            <h1 className="fp-page-title">FARMERS</h1>
            <p className="fp-page-sub">View and manage all registered farmers</p>
          </div>
          <input
            className="fp-search"
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="fp-stats">
          <div className="fp-stat">
            <p className="fp-stat-label">Total Farmers</p>
            <p className="fp-stat-val">{farmers.length}</p>
          </div>
          <div className="fp-stat">
            <p className="fp-stat-label">Showing</p>
            <p className="fp-stat-val">{filtered.length}</p>
          </div>
          <div className="fp-stat">
            <p className="fp-stat-label">Farm Groups</p>
            <p className="fp-stat-val">{Object.keys(farmGroupNames).length}</p>
          </div>
        </div>

        <div className="fp-table-wrap">
          <div className="fp-table-head">
            <span>Farmer</span>
            <span>Email</span>
            <span>Farm Group</span>
          </div>

          {filtered.length === 0 ? (
            <div className="fp-empty">
              <span className="fp-empty-icon">👨‍🌾</span>
              <p>No farmers found.</p>
            </div>
          ) : (
            filtered.map((f) => (
              <div className="fp-row" key={f.id}>
                <div className="fp-row-farmer">
                  <div className="fp-row-avatar">
                    {getInitials(f.firstName, f.lastName)}
                  </div>
                  <div>
                    <p className="fp-row-name">
                      {f.firstName || ""} {f.lastName || ""}
                    </p>
                    <p className="fp-row-id">UID: {f.id.slice(0, 8)}…</p>
                  </div>
                </div>

                <span className="fp-row-email">{f.email || "—"}</span>

                <span className="fp-row-group">
                  <span className="fp-group-badge">
                    {farmGroupNames[f.groupId] || "—"}
                  </span>
                </span>

                <div className="fp-row-actions">
                  <button
                    className="fp-btn fp-btn-edit"
                    onClick={() => handleEditClick(f)}
                  >
                    <FaEdit size={11} /> Edit
                  </button>
                  <button
                    className="fp-btn fp-btn-remove"
                    onClick={() => openRemoveModal(f)}
                  >
                    <FaTrash size={11} /> Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* ── EDIT MODAL ── */}
      {showEditModal && (
        <div className="fp-overlay">
          <div className="fp-modal">
            <div className="fp-modal-header">
              <h3>Edit Farmer</h3>
              <button className="fp-modal-x" onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <label className="fp-label">First Name</label>
            <input
              className="fp-input"
              type="text"
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
            />

            <label className="fp-label">Last Name</label>
            <input
              className="fp-input"
              type="text"
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
            />

            <label className="fp-label">Email</label>
            <input
              className="fp-input"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />

            <div className="fp-modal-footer">
              <button className="fp-modal-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="fp-modal-confirm" onClick={handleUpdateFarmer}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REMOVE CONFIRM MODAL ── */}
      {showRemoveModal && selectedFarmer && (
        <div className="fp-overlay">
          <div className="fp-modal fp-modal-sm">
            <div className="fp-modal-header">
              <h3>Remove Farmer</h3>
              <button className="fp-modal-x" onClick={() => setShowRemoveModal(false)}>✕</button>
            </div>
            <p className="fp-modal-body-text">
              Are you sure you want to remove{" "}
              <strong>{selectedFarmer.firstName} {selectedFarmer.lastName}</strong> from their farm group?
            </p>
            <div className="fp-modal-footer">
              <button className="fp-modal-cancel" onClick={() => setShowRemoveModal(false)}>Cancel</button>
              <button className="fp-modal-danger" onClick={handleRemove}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}