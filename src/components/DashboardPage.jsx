import React, { useEffect, useState, useCallback, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import axios from "axios";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import "react-circular-progressbar/dist/styles.css";
import "./DashboardPage.css";

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Title, Tooltip, Legend, Filler
);

const WEATHER_KEY = "17a5aa9601f1e26815cc0cd44578658e";

function toDate(val) {
  if (!val) return null;
  if (typeof val.toDate === "function") return val.toDate();
  if (typeof val === "string")          return new Date(val);
  if (val instanceof Date)              return val;
  return null;
}

function bucketLabel(date, filterType) {
  if (!date) return "Unknown";
  if (filterType === "daily") {
    return date.toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }
  if (filterType === "weekly") {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function fmtWater(ml) {
  if (!ml || ml <= 0) return "0 mL";
  if (ml >= 1000) return `${(ml / 1000).toFixed(2)} L`;
  return `${ml.toFixed(1)} mL`;
}

function computeTrend(readings = []) {
  if (readings.length < 2) return "stable";
  const recent = readings.slice(0, Math.min(5, readings.length));
  const first  = recent[recent.length - 1]?.soilMoisture ?? 0;
  const last   = recent[0]?.soilMoisture ?? 0;
  const delta  = last - first;
  if (delta >  2) return "rising";
  if (delta < -2) return "falling";
  return "stable";
}

const TREND_META = {
  rising:  { icon: "↑", label: "Rising",  color: "#2196f3" },
  falling: { icon: "↓", label: "Falling", color: "#e91e63" },
  stable:  { icon: "→", label: "Stable",  color: "#4caf50" },
};

export default function DashboardPage() {
  const navigate = useNavigate();

  const [weather, setWeather]         = useState(null);
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const [userName, setUserName]       = useState({ first: "", last: "" });
  const [photoURL, setPhotoURL]       = useState("");
  const [location, setLocation]       = useState({ lat: null, lon: null });

  const [farmGroups, setFarmGroups]   = useState([]);
  const [selectedFarmGroup, setSelectedFarmGroup] = useState("");
  const [farmGroupName, setFarmGroupName]         = useState("No Farm Group Selected");

  const [devices, setDevices]                       = useState([]);
  const [deviceReadingHistory, setDeviceReadingHistory] = useState({});
  const [irrigationSessions, setIrrigationSessions] = useState([]);

  const [loadingWeather, setLoadingWeather] = useState(true);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [filterType, setFilterType]         = useState("daily");
  const [unreadCount, setUnreadCount]       = useState(0);
  const [pendingCount, setPendingCount]     = useState(0); // ← NEW

  const unsubscribersRef = useRef([]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // ── FETCH USER + FARM GROUPS ──────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/login");
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserName({ first: data.firstName || "", last: data.lastName || "" });
          setPhotoURL(data.photoURL || "");
          setLocation({ lat: data.lat || null, lon: data.lon || null });
          setSelectedFarmGroup(data.selectedFarmGroupId || "");
        }
        const farmQuery = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );
        const snapshot = await getDocs(farmQuery);
        setFarmGroups(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  // ── REALTIME UNREAD NOTIFICATIONS ────────────────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.filter((d) => !d.data().read).length);
    });
    return () => unsub();
  }, []);

  // ── REALTIME PENDING FARMER REQUESTS ─────────────────────────────────────
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

  // ── REALTIME DEVICE + IRRIGATION LISTENERS ───────────────────────────────
  useEffect(() => {
    unsubscribersRef.current.forEach((fn) => fn());
    unsubscribersRef.current = [];

    if (!selectedFarmGroup) return;
    setLoadingDevices(true);

    const farmUnsub = onSnapshot(doc(db, "farmgroups", selectedFarmGroup), (snap) => {
      if (snap.exists())
        setFarmGroupName(snap.data().farmgroupName || "Unnamed Farm Group");
    });
    unsubscribersRef.current.push(farmUnsub);

    const devicesUnsub = onSnapshot(
      collection(db, "farmgroups", selectedFarmGroup, "devices"),
      async (deviceSnapshot) => {
        if (deviceSnapshot.empty) {
          setDevices([]);
          setIrrigationSessions([]);
          setDeviceReadingHistory({});
          setLoadingDevices(false);
          return;
        }

        const [fu, du, ...perDevice] = unsubscribersRef.current;
        perDevice.forEach((fn) => fn());
        unsubscribersRef.current = [fu, du];

        const devicesMap  = {};
        const historyMap  = {};
        const sessionsMap = {};

        const flush = () => {
          setDevices(Object.values(devicesMap));
          setDeviceReadingHistory({ ...historyMap });
          const all = Object.values(sessionsMap).flat();
          all.sort((a, b) => b.timestamp - a.timestamp);
          setIrrigationSessions(all);
          setLoadingDevices(false);
        };

        deviceSnapshot.docs.forEach((deviceDoc) => {
          const deviceData = deviceDoc.data();
          const devId      = deviceData.deviceID || deviceDoc.id;

          devicesMap[deviceDoc.id] = {
            id:           deviceDoc.id,
            deviceId:     devId,
            growthstage:  deviceData.growthstage || "N/A",
            latestReading: null,
          };
          historyMap[devId]  = [];
          sessionsMap[devId] = [];

          const readingsUnsub = onSnapshot(
            query(
              collection(db, "farmgroups", selectedFarmGroup, "devices", deviceDoc.id, "readings"),
              orderBy("time", "desc"),
              limit(10)
            ),
            (snap) => {
              const readings = snap.docs.map((d) => d.data());
              devicesMap[deviceDoc.id] = {
                ...devicesMap[deviceDoc.id],
                latestReading: readings[0] ?? null,
              };
              historyMap[devId] = readings;
              flush();
            }
          );

          const irrigUnsub = onSnapshot(
            collection(db, "farmgroups", selectedFarmGroup, "devices", deviceDoc.id, "irrigation"),
            (snap) => {
              const sessions = [];
              snap.forEach((iDoc) => {
                const ir     = iDoc.data();
                const status = ir.status ?? "";
                if (status !== "STOPPED") return;

                const waterAmountML = Number(ir.waterAmount            ?? 0);
                const estimatedML   = Number(ir.deviceEstimatedWaterML ?? 0);
                const recommendedML = Number(ir.recommendedWater       ?? 0);
                const amountML = waterAmountML > 0 ? waterAmountML
                               : estimatedML   > 0 ? estimatedML
                               : recommendedML > 0 ? recommendedML
                               : 0;
                if (amountML <= 0) return;

                const ts = toDate(ir.stoppedAt) ?? toDate(ir.startedAt) ?? toDate(ir.createdAt);
                if (!ts) return;

                sessions.push({
                  key:       `${devId}|${iDoc.id}`,
                  deviceId:  devId,
                  amountML,
                  amountL:   amountML / 1000,
                  timestamp: ts,
                  mode:      ir.mode ?? "AUTO",
                  soilMoisture: ir.soilMoisture ?? null,
                  soilStatus:   ir.soilStatus   ?? "",
                });
              });
              sessionsMap[devId] = sessions;
              flush();
            }
          );

          unsubscribersRef.current.push(readingsUnsub, irrigUnsub);
        });
      }
    );

    unsubscribersRef.current.push(devicesUnsub);

    return () => {
      unsubscribersRef.current.forEach((fn) => fn());
      unsubscribersRef.current = [];
    };
  }, [selectedFarmGroup]);

  // ── WEATHER ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchWeather = async () => {
      if (!location.lat || !location.lon) return;
      try {
        const res = await axios.get(
          "https://api.openweathermap.org/data/2.5/weather",
          { params: { lat: location.lat, lon: location.lon, appid: WEATHER_KEY, units: "metric" } }
        );
        setWeather(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingWeather(false);
      }
    };
    fetchWeather();
  }, [location]);

  // ── CLOCK ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!weather) return;
    const interval = setInterval(() => {
      const nowUTC    = new Date().getTime() + new Date().getTimezoneOffset() * 60000;
      const localTime = new Date(nowUTC + weather.timezone * 1000);
      setCurrentDate(
        localTime.toLocaleDateString(undefined, {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        })
      );
      setCurrentTime(
        localTime.toLocaleTimeString(undefined, {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [weather]);

  // ── SELECT FARM GROUP ─────────────────────────────────────────────────────
  const handleSelectFarmGroup = async (farmId, farmName) => {
    setSelectedFarmGroup(farmId);
    setFarmGroupName(farmName);
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { selectedFarmGroupId: farmId });
  };

  const getInitials = (first = "", last = "") =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  // ── BUILD BAR CHART DATA ──────────────────────────────────────────────────
  const getChartData = () => {
    if (!irrigationSessions.length) return { labels: [], datasets: [] };

    const deviceIds = [...new Set(irrigationSessions.map((s) => s.deviceId))].sort();

    const bucketMap = {};
    irrigationSessions.forEach((s) => {
      const label = bucketLabel(s.timestamp, filterType);
      if (!bucketMap[label]) bucketMap[label] = {};
      bucketMap[label][s.deviceId] = (bucketMap[label][s.deviceId] ?? 0) + s.amountL;
    });

    const labels = Object.keys(bucketMap).sort((a, b) => {
      const tA = irrigationSessions.find((s) => bucketLabel(s.timestamp, filterType) === a)?.timestamp ?? 0;
      const tB = irrigationSessions.find((s) => bucketLabel(s.timestamp, filterType) === b)?.timestamp ?? 0;
      return tA - tB;
    });

    const palette = [
      "#4caf50", "#2196f3", "#ff9800", "#e91e63",
      "#9c27b0", "#00bcd4", "#ff5722", "#8bc34a",
    ];

    const datasets = deviceIds.map((devId, idx) => ({
      label:           devId,
      data:            labels.map((l) => +(bucketMap[l][devId] ?? 0).toFixed(4)),
      backgroundColor: palette[idx % palette.length] + "cc",
      borderColor:     palette[idx % palette.length],
      borderWidth:     1,
      borderRadius:    4,
    }));

    return { labels, datasets };
  };

  // ── BUILD TREND SPARKLINE DATA ────────────────────────────────────────────
  const getTrendSparkline = (devId) => {
    const readings = [...(deviceReadingHistory[devId] ?? [])].reverse();
    if (readings.length < 2) return null;

    const labels = readings.map((r, i) => i);
    const data   = readings.map((r) => parseFloat((r.soilMoisture ?? 0).toFixed(1)));

    const trend = computeTrend(deviceReadingHistory[devId] ?? []);
    const color = TREND_META[trend].color;

    return {
      labels,
      datasets: [
        {
          data,
          borderColor:     color,
          backgroundColor: color + "22",
          borderWidth:     2,
          pointRadius:     0,
          fill:            true,
          tension:         0.4,
        },
      ],
    };
  };

  // ── AGGREGATES ────────────────────────────────────────────────────────────
  const totalWaterML = irrigationSessions.reduce((s, i) => s + i.amountML, 0);

  const perDeviceTotals = devices.map((d) => ({
    ...d,
    totalML:      irrigationSessions
                    .filter((s) => s.deviceId === d.deviceId)
                    .reduce((sum, s) => sum + s.amountML, 0),
    sessionCount: irrigationSessions.filter((s) => s.deviceId === d.deviceId).length,
  }));

  const getMoistureClass = (status = "") => {
    const s = status.toLowerCase();
    if (s.includes("wet"))  return "moisture--wet";
    if (s.includes("dry"))  return "moisture--dry";
    return "moisture--optimal";
  };
  const getMoistureColor = (status = "") => {
    const s = status.toLowerCase();
    if (s.includes("wet"))  return "#1976d2";
    if (s.includes("dry"))  return "#e91e8c";
    return "#4caf50";
  };

  const getDeviceStatus = (latestReading) => {
    if (!latestReading) return "offline";
    const lastSeen = toDate(latestReading.time) ?? toDate(latestReading.timestamp);
    if (!lastSeen) return "offline";
    return (Date.now() - lastSeen.getTime()) / 60000 <= 5 ? "active" : "offline";
  };

  const navClass  = ({ isActive }) => (isActive ? "active" : undefined);
  const chartData = getChartData();
  const hasChart  = chartData.datasets.length > 0 && chartData.labels.length > 0;

  const deviceTrends = devices.map((d) => {
    const history  = deviceReadingHistory[d.deviceId] ?? [];
    const trend    = computeTrend(history);
    const sparkline = getTrendSparkline(d.deviceId);
    const latest   = history[0];
    const moisture = parseFloat((latest?.soilMoisture ?? 0).toFixed(1));
    return { ...d, trend, sparkline, moisture, history };
  });

  return (
    <div className="db-dashboard">

      {/* ── SIDEBAR ── */}
      <aside className="db-sidebar">
        <div className="db-logo">
          <span className="db-logo-smart">Smart</span>AGRI
        </div>
        <div className="db-profile">
          <div className="db-avatar">
            {photoURL
              ? <img src={photoURL} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : (userName.first ? getInitials(userName.first, userName.last) : "AD")
            }
          </div>
          <div>
            <p className="db-profile-name">
              {userName.first ? `${userName.first} ${userName.last}` : "Loading..."}
            </p>
            <p className="db-profile-role">Registered Admin</p>
          </div>
        </div>
        <nav className="db-nav">
          <NavLink to="/dashboard" className={navClass} end>Dashboard</NavLink>
          <NavLink to="/register-farmer" className={navClass}>
            <span className="db-notif-link">
              Register Farmer
              {pendingCount > 0 && (
                <span className="db-notif-badge">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farmers" className={navClass}>Farmers</NavLink>
          <NavLink to="/notifications" className={navClass}>
            <span className="db-notif-link">
              Notification
              {unreadCount > 0 && (
                <span className="db-notif-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farm-group" className={navClass}>Farm Group</NavLink>
          <NavLink to="/profile" className={navClass}>Profile</NavLink>
        </nav>
        <button className="db-logout" onClick={handleLogout}>Logout</button>
      </aside>

      {/* ── MAIN ── */}
      <main className="db-main">

        {/* TOP BAR */}
        <div className="db-topbar">
          <div>
            <h1 className="db-page-title">DASHBOARD</h1>
            <p className="db-page-sub">Welcome back, {userName.first || "Admin"}</p>
          </div>
          <div className="db-farm-selector">
            <label className="db-selector-label">Active Farm Group</label>
            <select
              className="db-select"
              value={selectedFarmGroup}
              onChange={(e) => {
                const farmId = e.target.value;
                const name   = farmGroups.find((f) => f.id === farmId)?.farmgroupName || "";
                handleSelectFarmGroup(farmId, name);
              }}
            >
              <option value="">Select Farm Group</option>
              {farmGroups.map((f) => (
                <option key={f.id} value={f.id}>{f.farmgroupName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* STATS ROW */}
        <div className="db-stats">
          <div className="db-stat">
            <p className="db-stat-label">Active Devices</p>
            <p className="db-stat-val">{devices.length}</p>
          </div>
          <div className="db-stat">
            <p className="db-stat-label">Total Water Used</p>
            <p className="db-stat-val">{fmtWater(totalWaterML)}</p>
          </div>
          <div className="db-stat">
            <p className="db-stat-label">Avg per Device</p>
            <p className="db-stat-val">
              {devices.length > 0 ? fmtWater(totalWaterML / devices.length) : "0 mL"}
            </p>
          </div>
          <div className="db-stat">
            <p className="db-stat-label">Irrigation Sessions</p>
            <p className="db-stat-val">{irrigationSessions.length}</p>
          </div>
        </div>

        {/* CONTENT GRID */}
        <div className="db-content-grid">

          <div className="db-left-col">

            {/* WEATHER CARD */}
            <div className="db-card">
              <div className="db-card-header">
                <h2 className="db-card-title">Current Weather</h2>
              </div>
              {loadingWeather ? (
                <p className="db-placeholder">Loading weather...</p>
              ) : weather ? (
                <div className="db-weather-body">
                  <div className="db-weather-info">
                    <p className="db-weather-city">{weather.name}</p>
                    <p className="db-weather-temp">{weather.main.temp}°C</p>
                    <p className="db-weather-desc">{weather.weather[0].description}</p>
                    <div className="db-weather-meta">
                      <span>💧 {weather.main.humidity}%</span>
                      <span>💨 {weather.wind.speed} m/s</span>
                      <span>🌡 Feels {weather.main.feels_like}°C</span>
                    </div>
                    <p className="db-weather-date">{currentDate}</p>
                    <p className="db-weather-time">{currentTime}</p>
                  </div>
                  <img
                    src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`}
                    alt="weather icon"
                    className="db-weather-icon"
                  />
                </div>
              ) : (
                <p className="db-placeholder">No weather data available.</p>
              )}
            </div>

            {/* WATER ANALYTICS CARD */}
            <div className="db-card">
              <div className="db-card-header">
                <h2 className="db-card-title">Water Usage Analytics</h2>
                <span className="db-water-total">{fmtWater(totalWaterML)}</span>
              </div>

              <div className="db-datetime-row">
                <div className="db-datetime-block">
                  <span className="db-dt-label">Date</span>
                  <span className="db-dt-value">{currentDate || "—"}</span>
                </div>
                <div className="db-dt-divider" />
                <div className="db-datetime-block">
                  <span className="db-dt-label">Time</span>
                  <span className="db-dt-value db-dt-mono">{currentTime || "—"}</span>
                </div>
                <div className="db-dt-divider" />
                <div className="db-datetime-block">
                  <span className="db-dt-label">Sessions</span>
                  <span className="db-dt-value">{irrigationSessions.length}</span>
                </div>
              </div>

              <div className="db-filter-btns">
                {["daily", "weekly", "monthly"].map((f) => (
                  <button
                    key={f}
                    className={`db-filter-btn${filterType === f ? " active" : ""}`}
                    onClick={() => setFilterType(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              <div className="db-chart-wrap">
                {loadingDevices ? (
                  <div className="db-chart-empty">
                    <span>⏳</span>
                    <p>Loading irrigation data...</p>
                  </div>
                ) : hasChart ? (
                  <Bar
                    data={chartData}
                    options={{
                      responsive:          true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend:  { position: "top" },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => {
                              const ml = ctx.parsed.y * 1000;
                              return ` ${ctx.dataset.label}: ${fmtWater(ml)}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          grid:  { color: "rgba(0,0,0,0.04)" },
                          ticks: { font: { size: 11 }, maxRotation: 45 },
                        },
                        y: {
                          grid:  { color: "rgba(0,0,0,0.04)" },
                          ticks: {
                            font:     { size: 11 },
                            callback: (v) => fmtWater(v * 1000),
                          },
                          title: {
                            display: true,
                            text:    "Water Used",
                            font:    { size: 11 },
                          },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="db-chart-empty">
                    <span>📊</span>
                    <p>No irrigation data available</p>
                    <p className="db-chart-empty-sub">
                      Water usage will appear here after the first completed irrigation session.
                    </p>
                  </div>
                )}
              </div>

              {perDeviceTotals.length > 0 && (
                <div className="db-device-stat-row">
                  {perDeviceTotals.map((device) => (
                    <div className="db-device-stat" key={device.id}>
                      <p className="db-device-stat-label">{device.deviceId}</p>
                      <p className="db-device-stat-val">{fmtWater(device.totalML)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="db-right-col">

            {/* SOIL MOISTURE DEVICES */}
            <div className="db-card db-soil-card">
              <div className="db-card-header">
                <h2 className="db-card-title">Soil Moisture Devices</h2>
                <span className="db-device-count-badge">
                  {devices.length} device{devices.length !== 1 ? "s" : ""}
                </span>
              </div>

              {devices.length === 0 ? (
                <div className="db-soil-empty">
                  <span>🌱</span>
                  <p>No devices found for this farm group.</p>
                </div>
              ) : (
                <div className="db-device-grid">
                  {devices.map((device) => {
                    const moisture      = parseFloat(
                      (device.latestReading?.soilMoisture ?? 0).toFixed(1)
                    );
                    const status        = device.latestReading?.soilStatus || "No Data";
                    const moistureClass = getMoistureClass(status);
                    const color         = getMoistureColor(status);
                    const devStatus     = getDeviceStatus(device.latestReading);
                    const trend         = computeTrend(deviceReadingHistory[device.deviceId] ?? []);
                    const tm            = TREND_META[trend];

                    return (
                      <div className="db-device-card" key={device.id}>
                        <div className="db-device-header">
                          <p className="db-device-id">{device.deviceId}</p>
                          <span className={`db-online-badge db-online-badge--${devStatus}`}>
                            {devStatus === "active" ? "● Active" : "○ Offline"}
                          </span>
                        </div>

                        <div className="db-progress-wrap">
                          <CircularProgressbar
                            value={moisture}
                            maxValue={100}
                            text={`${moisture}%`}
                            styles={buildStyles({
                              pathColor:  color,
                              textColor:  "#1a1a1a",
                              trailColor: "#f0eeea",
                              textSize:   "18px",
                            })}
                          />
                        </div>

                        <div className="db-device-footer">
                          <span className={`db-soil-status ${moistureClass}`}>{status}</span>
                          <span className="db-growth-badge">{device.growthstage}</span>
                        </div>

                        {trend !== "stable" && (
                          <div className="db-device-trend-row">
                            <span
                              className="db-trend-badge db-trend-badge--sm"
                              style={{ color: tm.color, borderColor: tm.color + "44", background: tm.color + "11" }}
                            >
                              {tm.icon} {tm.label}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MOISTURE TRENDS */}
            <div className="db-card db-trends-card">
              <div className="db-card-header">
                <h2 className="db-card-title">Moisture Trends</h2>
                <span className="db-device-count-badge">Last 10 readings</span>
              </div>

              {deviceTrends.length === 0 ? (
                <div className="db-soil-empty">
                  <span>📈</span>
                  <p>No trend data yet.</p>
                </div>
              ) : (
                <div className="db-trends-list">
                  {deviceTrends.map((d) => {
                    const tm = TREND_META[d.trend];
                    return (
                      <div className="db-trend-card" key={d.id}>
                        <div className="db-trend-header">
                          <span className="db-trend-device-id">{d.deviceId}</span>
                          <span
                            className="db-trend-badge"
                            style={{ color: tm.color, borderColor: tm.color + "44", background: tm.color + "11" }}
                          >
                            {tm.icon} {tm.label}
                          </span>
                        </div>
                        <div className="db-trend-moisture">
                          <span className="db-trend-value">{d.moisture}%</span>
                          <span className="db-trend-label">moisture</span>
                        </div>
                        <div className="db-trend-sparkline">
                          {d.sparkline ? (
                            <Line
                              data={d.sparkline}
                              options={{
                                responsive:          true,
                                maintainAspectRatio: false,
                                animation:           false,
                                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                                scales: {
                                  x: { display: false },
                                  y: {
                                    display: true,
                                    min: 0, max: 100,
                                    grid: { color: "rgba(0,0,0,0.04)" },
                                    ticks: { font: { size: 9 }, callback: (v) => `${v}%` },
                                  },
                                },
                              }}
                            />
                          ) : (
                            <div className="db-trend-no-data">Not enough data</div>
                          )}
                        </div>
                        <p className="db-trend-readings-count">
                          {d.history.length} reading{d.history.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}