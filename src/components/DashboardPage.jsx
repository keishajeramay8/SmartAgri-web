import React, { useEffect, useState } from "react";
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
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "react-circular-progressbar/dist/styles.css";
import "./DashboardPage.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const WEATHER_KEY = "17a5aa9601f1e26815cc0cd44578658e";

export default function DashboardPage() {
  const navigate = useNavigate();

  const [weather, setWeather] = useState(null);
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const [userName, setUserName] = useState({ first: "", last: "" });
  const [location, setLocation] = useState({ lat: null, lon: null });

  const [farmGroups, setFarmGroups] = useState([]);
  const [selectedFarmGroup, setSelectedFarmGroup] = useState("");
  const [farmGroupName, setFarmGroupName] = useState("No Farm Group Selected");

  const [devices, setDevices] = useState([]);
  const [totalWaterUsage, setTotalWaterUsage] = useState(0);
  const [waterChartData, setWaterChartData] = useState({ labels: [], datasets: [] });

  const [loadingWeather, setLoadingWeather] = useState(true);
  const [filterType, setFilterType] = useState("daily");

  const [unreadCount, setUnreadCount] = useState(0);

  // LOGOUT
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // FETCH USER + FARM GROUPS
  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/login");
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserName({ first: data.firstName || "", last: data.lastName || "" });
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

  // REALTIME UNREAD NOTIFICATIONS
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

  // FETCH DEVICES + READINGS + IRRIGATION
  useEffect(() => {
    const fetchDeviceData = async () => {
      if (!selectedFarmGroup) return;
      try {
        const farmSnap = await getDoc(doc(db, "farmgroups", selectedFarmGroup));
        if (farmSnap.exists())
          setFarmGroupName(farmSnap.data().farmgroupName || "Unnamed Farm Group");

        const deviceSnapshot = await getDocs(
          collection(db, "farmgroups", selectedFarmGroup, "devices")
        );

        if (deviceSnapshot.empty) {
          setDevices([]);
          setTotalWaterUsage(0);
          setWaterChartData({ labels: [], datasets: [] });
          return;
        }

        let totalWater = 0;
        let labelsSet = new Set();

        const deviceList = await Promise.all(
          deviceSnapshot.docs.map(async (deviceDoc) => {
            const deviceData = deviceDoc.data();
            const readingsRef = query(
              collection(
                db,
                "farmgroups",
                selectedFarmGroup,
                "devices",
                deviceDoc.id,
                "readings"
              ),
              orderBy("time", "desc"),
              limit(10)
            );
            const readingsSnap = await getDocs(readingsRef);
            let latest = null;
            let irrigationPoints = [];

            if (!readingsSnap.empty) {
              latest = readingsSnap.docs[0].data();
              for (let r of readingsSnap.docs) {
                const irrigationSnap = await getDocs(
                  collection(r.ref, "irrigations")
                );
                irrigationSnap.forEach((d) => {
                  const ir = d.data();
                  if (!ir.time) return;
                  const timeLabel = ir.time.toDate().toLocaleString();
                  const volumeLiters = (ir.volumeML || 0) / 1000;
                  irrigationPoints.push({ time: timeLabel, volume: volumeLiters });
                  totalWater += volumeLiters;
                  labelsSet.add(timeLabel);
                });
              }
            }

            return {
              id: deviceDoc.id,
              deviceId: deviceData.deviceID || deviceDoc.id,
              growthstage: deviceData.growthstage || "N/A",
              latestReading: latest,
              irrigationPoints,
            };
          })
        );

        const labels = Array.from(labelsSet).sort();
        const datasets = deviceList.map((device, idx) => {
          const map = {};
          device.irrigationPoints.forEach((p) => {
            if (!map[p.time]) map[p.time] = 0;
            map[p.time] += p.volume;
          });
          return {
            label: device.deviceId,
            data: labels.map((l) => map[l] || 0),
            borderColor: `hsl(${(idx * 60) % 360}, 70%, 50%)`,
            backgroundColor: "transparent",
          };
        });

        setDevices(deviceList);
        setTotalWaterUsage(totalWater);
        setWaterChartData({ labels, datasets });
      } catch (error) {
        console.error("Device loading error:", error);
      }
    };

    fetchDeviceData();
    const interval = setInterval(fetchDeviceData, 10000);
    return () => clearInterval(interval);
  }, [selectedFarmGroup]);

  // WEATHER
  useEffect(() => {
    const fetchWeather = async () => {
      if (!location.lat || !location.lon) return;
      try {
        const res = await axios.get(
          "https://api.openweathermap.org/data/2.5/weather",
          {
            params: {
              lat: location.lat,
              lon: location.lon,
              appid: WEATHER_KEY,
              units: "metric",
            },
          }
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

  // CLOCK
  useEffect(() => {
    if (!weather) return;
    const interval = setInterval(() => {
      const nowUTC =
        new Date().getTime() + new Date().getTimezoneOffset() * 60000;
      const localTime = new Date(nowUTC + weather.timezone * 1000);
      setCurrentDate(
        localTime.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
      setCurrentTime(
        localTime.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [weather]);

  // SELECT FARM GROUP
  const handleSelectFarmGroup = async (farmId, farmName) => {
    setSelectedFarmGroup(farmId);
    setFarmGroupName(farmName);
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { selectedFarmGroupId: farmId });
  };

  const getInitials = (first = "", last = "") =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  // COMPUTE FILTERED CHART DATA
  const getFilteredChartData = () => {
    if (!waterChartData.datasets.length) return waterChartData;
    const grouped = {};
    const newLabelsSet = new Set();

    waterChartData.labels.forEach((label, index) => {
      const dateObj = new Date(label);
      let newLabel;
      if (filterType === "daily") newLabel = dateObj.toLocaleTimeString();
      else if (filterType === "weekly") newLabel = dateObj.toLocaleDateString();
      else newLabel = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}`;

      newLabelsSet.add(newLabel);
      waterChartData.datasets.forEach((dataset) => {
        if (!grouped[dataset.label]) grouped[dataset.label] = {};
        if (!grouped[dataset.label][newLabel])
          grouped[dataset.label][newLabel] = 0;
        grouped[dataset.label][newLabel] += dataset.data[index] || 0;
      });
    });

    const newLabels = Array.from(newLabelsSet).sort();
    const newDatasets = waterChartData.datasets.map((dataset) => ({
      ...dataset,
      data: newLabels.map((l) => grouped[dataset.label]?.[l] || 0),
    }));
    return { labels: newLabels, datasets: newDatasets };
  };

  // MOISTURE STATUS COLOR
  const getMoistureColor = (status = "") => {
    const s = status.toLowerCase();
    if (s.includes("wet") || s.includes("high")) return "#1976d2";
    if (s.includes("dry") || s.includes("low")) return "#e91e8c";
    return "#4caf50";
  };

  return (
    <div className="db-dashboard">
      {/* ── SIDEBAR ── */}
      <aside className="db-sidebar">
        <div className="db-logo">
          <span className="db-logo-smart">Smart</span>AGRI
        </div>

        <div className="db-profile">
          <div className="db-avatar">
            {userName.first ? getInitials(userName.first, userName.last) : "AD"}
          </div>
          <div>
            <p className="db-profile-name">
              {userName.first
                ? `${userName.first} ${userName.last}`
                : "Loading..."}
            </p>
            <p className="db-profile-role">Registered Admin</p>
          </div>
        </div>

        <nav className="db-nav">
          <NavLink to="/dashboard" className="active">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/notifications">
            <span className="db-notif-link">
              Notification
              {unreadCount > 0 && (
                <span className="db-notif-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/farm-group">Farm Group</NavLink>
        </nav>

        <button className="db-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      {/* ── MAIN ── */}
      <main className="db-main">

        {/* TOP BAR */}
        <div className="db-topbar">
          <div>
            <h1 className="db-page-title">Dashboard</h1>
            <p className="db-page-sub">Welcome back, {userName.first || "Admin"}</p>
          </div>

          {/* FARM GROUP SELECTOR */}
          <div className="db-farm-selector">
            <label className="db-selector-label">Active Farm Group</label>
            <select
              className="db-select"
              value={selectedFarmGroup}
              onChange={(e) => {
                const farmId = e.target.value;
                const name =
                  farmGroups.find((f) => f.id === farmId)?.farmgroupName || "";
                handleSelectFarmGroup(farmId, name);
              }}
            >
              <option value="">Select Farm Group</option>
              {farmGroups.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farmgroupName}
                </option>
              ))}
            </select>
            {selectedFarmGroup && (
              <span className="db-active-badge">{farmGroupName}</span>
            )}
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
            <p className="db-stat-val">{totalWaterUsage.toFixed(1)} L</p>
          </div>
          <div className="db-stat">
            <p className="db-stat-label">Avg per Device</p>
            <p className="db-stat-val">
              {devices.length > 0
                ? (totalWaterUsage / devices.length).toFixed(1) + " L"
                : "0 L"}
            </p>
          </div>
          <div className="db-stat">
            <p className="db-stat-label">Farm Groups</p>
            <p className="db-stat-val">{farmGroups.length}</p>
          </div>
        </div>

        {/* CONTENT GRID */}
        <div className="db-content-grid">

          {/* LEFT COLUMN */}
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
                    <p className="db-weather-desc">
                      {weather.weather[0].description}
                    </p>
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
                    alt="weather"
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
                <span className="db-water-total">
                  {totalWaterUsage.toFixed(2)} L
                </span>
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
                {waterChartData.datasets.length > 0 ? (
                  <Line
                    data={getFilteredChartData()}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: "top" },
                        title: {
                          display: false,
                        },
                      },
                      elements: { line: { tension: 0.4 } },
                      scales: {
                        x: {
                          grid: { color: "rgba(0,0,0,0.04)" },
                          ticks: { font: { size: 11 } },
                        },
                        y: {
                          grid: { color: "rgba(0,0,0,0.04)" },
                          ticks: { font: { size: 11 } },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="db-chart-empty">
                    <span>📊</span>
                    <p>No irrigation data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — SOIL MOISTURE */}
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
                  const moisture = device.latestReading?.soilMoisture ?? 0;
                  const status = device.latestReading?.soilStatus || "No Data";
                  const color = getMoistureColor(status);

                  return (
                    <div className="db-device-card" key={device.id}>
                      <div className="db-device-top">
                        <div>
                          <p className="db-device-id">{device.deviceId}</p>
                          <span className="db-growth-badge">
                            {device.growthstage}
                          </span>
                        </div>
                        <div
                          className="db-status-dot"
                          style={{ background: color }}
                          title={status}
                        />
                      </div>

                      <div className="db-progress-wrap">
                        <CircularProgressbar
                          value={moisture}
                          maxValue={100}
                          text={`${moisture}%`}
                          styles={buildStyles({
                            pathColor: color,
                            textColor: "#1a1a1a",
                            trailColor: "#f0eeea",
                            textSize: "18px",
                          })}
                        />
                      </div>

                      <div className="db-device-footer">
                        <span
                          className="db-soil-status"
                          style={{ color }}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}