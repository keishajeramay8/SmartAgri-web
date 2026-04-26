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
  query,
  where,
  onSnapshot,
  orderBy,
  writeBatch,
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
  const [pendingCount, setPendingCount] = useState(0);

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

  // Realtime Pending Farmer Requests
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
            countMap[groupId] = snap.docs.filter((d) => !d.data().seenByAdmin).length;
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

          const members = await Promise.all(
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
          farmerList = [...farmerList, ...members];
        }

        setFarmGroupNames(namesMap);
        setFarmers(farmerList);
      } catch (error) {
        console.error(error);
      }
    };
    loadFarmers();
  }, []);

  // Mark Notifications as Read
  const handleNotificationsNav = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const q = query(
        collection(db, "users", user.uid, "notifications"),
        where("read", "==", false)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
        await batch.commit();
      }
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  // Mark Join Requests as Seen
  const handleRegisterFarmerNav = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const groupQuery = query(
        collection(db, "farmgroups"),
        where("createdBy", "==", user.uid)
      );
      const groupSnapshot = await getDocs(groupQuery);
      const batch = writeBatch(db);
      let hasPending = false;

      for (const groupDoc of groupSnapshot.docs) {
        const joinRef = collection(db, "farmgroups", groupDoc.id, "joinRequests");
        const joinSnap = await getDocs(
          query(joinRef, where("seenByAdmin", "==", false))
        );
        joinSnap.docs.forEach((d) => {
          batch.update(d.ref, { seenByAdmin: true });
          hasPending = true;
        });
      }

      if (hasPending) await batch.commit();
      setPendingCount(0);
    } catch (err) {
      console.error("Failed to mark join requests as seen:", err);
    }
  };

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
          <NavLink
            to="/register-farmer"
            className={navClass}
            onClick={handleRegisterFarmerNav}
          >
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
          <NavLink
            to="/notifications"
            className={navClass}
            onClick={handleNotificationsNav}
          >
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

        {/* STATS */}
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

        {/* ── FARMERS CARD — matches RegisterFarmerPage style ── */}
        <div className="f-table-section">

          {/* Card header */}
          <div className="f-card-header">
            <h2 className="f-card-title">Registered Farmers</h2>
            {filtered.length > 0 && (
              <span className="f-pending-badge">
                {filtered.length} farmer{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Table header */}
          <div className="f-table-header fp-cols">
            <span>Farmer</span>
            <span>Email</span>
            <span>Farm Group</span>
            <span>Action</span>
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="f-empty">
              <span>👨‍🌾</span>
              <p>No farmers found.</p>
            </div>
          ) : (
            filtered.map((f) => (
              <div className="f-row fp-cols" key={f.id}>

                {/* Farmer cell */}
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

                {/* Email */}
                <span className="fp-row-email">{f.email || "—"}</span>

                {/* Farm Group badge */}
                <span>
                  <span className="f-pending-badge" style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                    {farmGroupNames[f.groupId] || "—"}
                  </span>
                </span>

                {/* Remove action */}
                <div className="f-actions">
                  <button
                    className="remove"
                    onClick={() => openRemoveModal(f)}
                    title="Remove"
                  >
                    <FaTrash size={11} />
                  </button>
                </div>

              </div>
            ))
          )}
        </div>
      </main>

      {/* REMOVE CONFIRM MODAL */}
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