// src/components/DashboardPage.jsx
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
  updateDoc
} from "firebase/firestore";
import axios from "axios";
import "./DashboardPage.css";

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
  const [deviceId, setDeviceId] = useState("No Device Registered");

  const [loadingWeather, setLoadingWeather] = useState(true);

  // Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Fetch Profile + FarmGroups
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

        // Fetch farmgroups created by user
        const farmQuery = query(
          collection(db, "farmgroups"),
          where("createdBy", "==", user.uid)
        );

        const snapshot = await getDocs(farmQuery);

        setFarmGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, []);

  // Selected FarmGroup Fetch
  useEffect(() => {
    const fetchSelectedFarmGroupData = async () => {
      if (!selectedFarmGroup) {
        setFarmGroupName("No Farm Group Selected");
        setDeviceId("No Device Registered");
        return;
      }

      try {
        const farmDoc = await getDoc(doc(db, "farmgroups", selectedFarmGroup));

        if (farmDoc.exists()) {
          const data = farmDoc.data();
          setFarmGroupName(data.farmgroupName || "Unnamed Farm Group");
          setDeviceId(data.deviceId || "No Device Registered");
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchSelectedFarmGroupData();
  }, [selectedFarmGroup]);

  // Handle FarmGroup Selection
  const handleSelectFarmGroup = async (farmId, farmName) => {
    if (!farmId) return;
    setSelectedFarmGroup(farmId);
    setFarmGroupName(farmName);

    const user = auth.currentUser;
    if (!user) return;

    await updateDoc(doc(db, "users", user.uid), { selectedFarmGroupId: farmId });
  };

  // Weather Fetch
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

      setCurrentDate(localTime.toLocaleDateString(undefined, {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      }));
      setCurrentTime(localTime.toLocaleTimeString(undefined, {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [weather]);

  return (
   <div className="dashboard">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="logo">
          <span className="italic">Smart</span>AGRI
        </h2>

        <div className="profile">
          <div className="avatar"></div>
          <h4>
            {userName.first || "Loading..."} {userName.last}
          </h4>
          <span className="role">Registered Admin</span>
        </div>


        <nav className="f-menu">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/register-farmer">Register Farmer</NavLink>
          <NavLink to="/farmers">Farmers</NavLink>
          <NavLink to="/soil-status">Soil Moisture Status</NavLink>
          <NavLink to="/notifications">Notification</NavLink>
          <NavLink to="/farm-group">Farm Group</NavLink>
          <hr />
        </nav>

        <button className="logout" onClick={handleLogout}>Logout</button>
      </aside>

      <main className="main">

        <header className="header">
          <div>
            <h1>DASHBOARD</h1>
            <p>Welcome to your SmartAGRI Dashboard!</p>
          </div>
        </header>

        {/* Cards */}
        <div className="cards">

          {/* Farm Group Card with Dropdown */}
          <div className="card">
            <p>Farm Group</p>
            <h2>{farmGroupName}</h2>

            <select
              value={selectedFarmGroup}
              onChange={(e) => {
                const farmId = e.target.value;
                const farmName = farmGroups.find(f => f.id === farmId)?.farmgroupName || "";
                handleSelectFarmGroup(farmId, farmName);
              }}
              style={{
                width: "100%",
                padding: "6px",
                marginTop: "10px",
                borderRadius: "6px",
                border: "1px solid #ddd"
              }}
            >
              <option value="">Select Farm Group</option>
              {farmGroups.map(f => (
                <option key={f.id} value={f.id}>{f.farmgroupName}</option>
              ))}
            </select>
          </div>

          <StatCard title="Device ID" value={deviceId} />
          <StatCard title="Avg Moisture" value="20%" />
          <StatCard title="Water Used Today" value="45 L" />

        </div>

        {/* Weather + Soil Moisture */}
        <div className="row">

          <div className="weather">
            <h3>Current Weather</h3>
            {loadingWeather ? (
              <p>Loading weather...</p>
            ) : weather ? (
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
                  style={{ width: "180px" }}
                />
              </div>
            ) : <p>No weather data</p>}
          </div>

          <div className="soil">
            <h3>Soil Moisture</h3>
            <p><strong>Farm Group:</strong> {farmGroupName}</p>
            <p><strong>Device ID:</strong> {deviceId}</p>
          </div>

        </div>

      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value }) {
  return (
    <div className="card">
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}