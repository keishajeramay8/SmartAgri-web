import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy, limit } from "firebase/firestore";
import axios from "axios";
import { CircularProgressbar } from "react-circular-progressbar";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";
import "react-circular-progressbar/dist/styles.css";
import "./DashboardPage.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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

  // ✅ Analytics Filter
  const [filterType, setFilterType] = useState("daily");

  // Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Fetch User + Farm Groups
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

        const farmQuery = query(collection(db, "farmgroups"), where("createdBy", "==", user.uid));
        const snapshot = await getDocs(farmQuery);
        setFarmGroups(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, []);

  // Fetch Devices + Readings + Irrigation
  useEffect(() => {
    const fetchDeviceData = async () => {
      if (!selectedFarmGroup) return;

      try {
        const farmRef = doc(db, "farmgroups", selectedFarmGroup);
        const farmSnap = await getDoc(farmRef);
        if (farmSnap.exists()) setFarmGroupName(farmSnap.data().farmgroupName || "Unnamed Farm Group");

        const devicesRef = collection(db, "farmgroups", selectedFarmGroup, "devices");
        const deviceSnapshot = await getDocs(devicesRef);

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
              collection(db, "farmgroups", selectedFarmGroup, "devices", deviceDoc.id, "readings"),
              orderBy("time", "desc"),
              limit(10)
            );

            const readingsSnap = await getDocs(readingsRef);

            let latest = null;
            let irrigationPoints = [];

            if (!readingsSnap.empty) {
              latest = readingsSnap.docs[0].data();

              for (let r of readingsSnap.docs) {
                const irrigationRef = collection(r.ref, "irrigations");
                const irrigationSnap = await getDocs(irrigationRef);

                irrigationSnap.forEach((doc) => {
                  const ir = doc.data();
                  if (!ir.time) return;

                  const timeObj = ir.time.toDate();
                  const timeLabel = timeObj.toLocaleString();

                  const volumeLiters = (ir.volumeML || 0) / 1000;

                  irrigationPoints.push({
                    time: timeLabel,
                    volume: volumeLiters
                  });

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
              irrigationPoints
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

  // Weather
  useEffect(() => {
    const fetchWeather = async () => {
      if (!location.lat || !location.lon) return;
      try {
        const res = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
          params: { lat: location.lat, lon: location.lon, appid: WEATHER_KEY, units: "metric" }
        });
        setWeather(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingWeather(false);
      }
    };
    fetchWeather();
  }, [location]);

  // Clock
  useEffect(() => {
    if (!weather) return;
    const interval = setInterval(() => {
      const nowUTC = new Date().getTime() + new Date().getTimezoneOffset() * 60000;
      const localTime = new Date(nowUTC + weather.timezone * 1000);
      setCurrentDate(localTime.toLocaleDateString(undefined, { weekday:"long", year:"numeric", month:"long", day:"numeric" }));
      setCurrentTime(localTime.toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit", second:"2-digit" }));
    }, 1000);
    return () => clearInterval(interval);
  }, [weather]);

  // Select Farm Group
  const handleSelectFarmGroup = async (farmId, farmName) => {
    setSelectedFarmGroup(farmId);
    setFarmGroupName(farmName);
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), { selectedFarmGroupId: farmId });
  };

  return (
    <div className="dashboard">

      <aside className="sidebar">
        <h2 className="logo"><span className="italic">Smart</span>AGRI</h2>

        <div className="profile">
          <div className="avatar"></div>
          <h4>{userName.first} {userName.last}</h4>
          <span className="role">Registered Admin</span>
        </div>

        <nav className="menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/notifications">Notification</NavLink>
          <NavLink to="/farm-group">Farm Group</NavLink>
          <hr />
        </nav>

        <button className="logout" onClick={handleLogout}>Logout</button>
      </aside>

      <main className="main">

        <header className="header">
          <h1>Dashboard</h1>
        </header>

        <div className="cards">
          <div className="card farm-group-card">
            <h3>Farm Group</h3>
            <h2>{farmGroupName}</h2>
            <select
              value={selectedFarmGroup}
              onChange={(e) => {
                const farmId = e.target.value;
                const farmName = farmGroups.find((f) => f.id === farmId)?.farmgroupName || "";
                handleSelectFarmGroup(farmId, farmName);
              }}
              className="farm-select"
            >
              <option value="">Select Farm Group</option>
              {farmGroups.map((f) => (
                <option key={f.id} value={f.id}>{f.farmgroupName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="cards second-row">
          <div className="weather-column">

            <div className="card weather-card">
              <h3>Current Weather</h3>
              {loadingWeather ? <p>Loading weather...</p> : weather ? (
                <div className="weather-content">
                  <div>
                    <p>{weather.name}</p>
                    <p>{currentDate}</p>
                    <p>{currentTime}</p>
                    <p>{weather.main.temp}°C</p>
                    <p>{weather.weather[0].description}</p>
                  </div>
                  <img
                    src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`}
                    alt="weather-icon"
                    className="weather-icon"
                  />
                </div>
              ) : <p>No weather data</p>}
            </div>

            {/* ✅ WATER USAGE ANALYTICS CARD */}
            <div className="card water-card">

              <div className="water-header">
                <h3>Water Usage Analytics</h3>
                <span className="water-total">{totalWaterUsage.toFixed(2)} L</span>
              </div>

              <div className="water-summary">
                <span>Devices: {devices.length}</span>
                <span>
                  Average per Device:{" "}
                  {devices.length > 0
                    ? (totalWaterUsage / devices.length).toFixed(2) + " L"
                    : "0 L"}
                </span>
              </div>

              <div className="water-period-buttons">
                <button
                  className={filterType === "daily" ? "active" : ""}
                  onClick={() => setFilterType("daily")}
                >
                  Daily
                </button>
                <button
                  className={filterType === "weekly" ? "active" : ""}
                  onClick={() => setFilterType("weekly")}
                >
                  Weekly
                </button>
                <button
                  className={filterType === "monthly" ? "active" : ""}
                  onClick={() => setFilterType("monthly")}
                >
                  Monthly
                </button>
              </div>

              <div className="water-chart-container">
                {waterChartData.datasets.length > 0 ? (
                  <Line
                    data={(() => {
                      const grouped = {};
                      const newLabelsSet = new Set();

                      waterChartData.labels.forEach((label, index) => {
                        const dateObj = new Date(label);
                        let newLabel;

                        if (filterType === "daily") {
                          newLabel = dateObj.toLocaleTimeString();
                        } else if (filterType === "weekly") {
                          newLabel = dateObj.toLocaleDateString();
                        } else {
                          newLabel = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}`;
                        }

                        newLabelsSet.add(newLabel);

                        waterChartData.datasets.forEach((dataset) => {
                          if (!grouped[dataset.label]) grouped[dataset.label] = {};
                          if (!grouped[dataset.label][newLabel]) grouped[dataset.label][newLabel] = 0;

                          grouped[dataset.label][newLabel] += dataset.data[index] || 0;
                        });
                      });

                      const newLabels = Array.from(newLabelsSet).sort();

                      const newDatasets = waterChartData.datasets.map((dataset) => ({
                        ...dataset,
                        data: newLabels.map((l) => grouped[dataset.label]?.[l] || 0),
                      }));

                      return { labels: newLabels, datasets: newDatasets };
                    })()}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { position: "top" },
                        title: {
                          display: true,
                          text: `Water Usage (${filterType.toUpperCase()})`,
                        },
                      },
                      elements: { line: { tension: 0.4 } },
                    }}
                  />
                ) : (
                  <p>No irrigation data available</p>
                )}
              </div>

            </div>

          </div>

          <div className="card soil-card">
            <h3>SOIL MOISTURE DEVICES</h3>
            {devices.length === 0 && <p>No devices found</p>}
            <div className="device-grid">
              {devices.map((device) => (
                <div key={device.id} className="device-box">
                  <p><strong>Device:</strong> {device.deviceId}</p>
                  <h5><strong>Growth Stage:</strong> {device.growthstage}</h5>
                  <div className="soil-chart">
                    <CircularProgressbar
                      value={device.latestReading ? device.latestReading.soilMoisture : 0}
                      maxValue={100}
                      text={`${device.latestReading ? device.latestReading.soilMoisture : 0}%`}
                    />
                  </div>
                  <p><strong>Status:</strong>{" "}{device.latestReading ? device.latestReading.soilStatus || "N/A" : "No Data"}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </main>

    </div>
  );
}