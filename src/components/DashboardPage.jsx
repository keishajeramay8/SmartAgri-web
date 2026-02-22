import React, { useEffect, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
  const [loadingWeather, setLoadingWeather] = useState(true);

  // Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Load Admin Profile
  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;

      if (!user) {
        navigate("/login");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));

        if (snap.exists()) {
          const data = snap.data();

          setUserName({
            first: data.firstName || "",
            last: data.lastName || ""
          });

          if (data.lat && data.lon) {
            setLocation({
              lat: data.lat,
              lon: data.lon
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchUser();
  }, []);

  // Fetch Weather
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
              units: "metric"
            }
          }
        );

        setWeather(res.data);
      } catch (err) {
        console.error("Weather error", err);
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchWeather();
  }, [location]);

  // Clock Update
  useEffect(() => {
    if (!weather) return;

    const interval = setInterval(() => {
      const nowUTC =
        new Date().getTime() +
        new Date().getTimezoneOffset() * 60000;

      const localTime = new Date(
        nowUTC + weather.timezone * 1000
      );

      setCurrentDate(
        localTime.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        })
      );

      setCurrentTime(
        localTime.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      );
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
            {userName.first
              ? `${userName.first} ${userName.last}`
              : "Loading..."}
          </h4>

          <span className="role">Registered Admin</span>
        </div>

        {/* MENU */}
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

      {/* MAIN CONTENT */}
      <main className="main">

        {/* HEADER */}
        <header className="header">
          <div>
            <h1>DASHBOARD</h1>
            <p>Welcome to your SmartAGRI Dashboard!</p>
          </div>

          <div className="header-right">
            <Link to="/create-farm-group">
              <button className="farm-group-btn">
                Farm Group
              </button>
            </Link>
          </div>
        </header>

        {/* STAT CARDS */}
        <div className="cards">
          <StatCard title="Total Devices" value="24" />
          <StatCard title="Active Devices" value="18" />
          <StatCard title="Avg Moisture" value="20%" />
          <StatCard title="Water Used Today" value="45 L" />
        </div>

        {/* WEATHER + SOIL ROW */}
        <div className="row">

          {/* WEATHER */}
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
                  alt="weather"
                  style={{ width: "180px", height: "180px" }}
                />
              </div>
            ) : (
              <p>Weather data not available for your location</p>
            )}
          </div>

          {/* SOIL GRAPH PLACEHOLDER */}
          <div className="soil">
            <h3>Soil Moisture</h3>
            <div className="graph-placeholder"></div>
          </div>

        </div>

        {/* ANALYTICS */}
        <div className="analytics">
          <h3>Analytics</h3>

          <div className="analytics-row">
            <div className="box">Analytics Box 1</div>
            <div className="box">Analytics Box 2</div>
            <div className="box">Analytics Box 3</div>
          </div>

          <div className="bars">
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
          </div>
        </div>

      </main>
    </div>
  );
}

// CARD COMPONENT
function StatCard({ title, value }) {
  return (
    <div className="card">
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}