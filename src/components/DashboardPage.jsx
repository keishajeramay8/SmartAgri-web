import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { auth, database } from "../firebase";
import { ref, get } from "firebase/database";
import "./DashboardPage.css";

export default function DashboardPage() {
  const [weather, setWeather] = useState(null);
  const [address, setAddress] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [userName, setUserName] = useState({ first: "", last: "" });
  const apiKey = "17a5aa9601f1e26815cc0cd44578658e";

  // Fetch logged-in user's name and address from Firebase
  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setUserName({ first: data.firstName, last: data.lastName });
          setAddress(data.address || "");
        } else {
          console.log("No user data found.");
        }
      }
    };

    const timeout = setTimeout(fetchUserData, 500);
    return () => clearTimeout(timeout);
  }, []);

  // Fetch weather data based on the user's address
  useEffect(() => {
    const fetchWeather = async () => {
      if (!address) return;
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${address}&appid=${apiKey}&units=metric`
        );
        const data = await res.json();
        if (data.cod === 200) setWeather(data);
        else console.error("City not found or API error:", data.message);
      } catch (error) {
        console.error("Weather API error:", error);
      }
    };
    fetchWeather();
  }, [address]);

  // Update exact local date & time based on weather.timezone
  useEffect(() => {
    if (!weather) return;
    const updateTime = () => {
      const nowUTC = new Date().getTime() + new Date().getTimezoneOffset() * 60000;
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
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [weather]);

  return (
    <div className="dashboard">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="logo">
          <span className="italic">Smart</span>AGRI
        </h2>

        {/* Profile on the left sidebar */}
        <div className="profile">
          <div className="avatar"></div>
          <h4>{userName.first} {userName.last}</h4>
          <span className="role">Registered Admin</span>
        </div>

        <nav className="menu">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/register-farmer">Register Farmer</Link>
          <Link to="/farmers">Farmers</Link>
          <Link to="/soil-status">Soil Moisture Status</Link>
          <Link to="/notifications">Notification</Link>
          <Link to="/terms">Terms and Conditions</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/report">Report</Link>
        </nav>

        <button className="logout">Logout</button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        <header className="header">
          <div>
            <h1>DASHBOARD</h1>
            <p>Welcome to your SmartAGRI Dashboard!</p>
          </div>

          {/* Only Farm Group button on the upper right */}
          <div className="header-right">
            <Link to="/create-farm-group">
              <button className="farm-group-btn">Farm Group</button>
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
          <div className="weather">
            <h3>Current Weather</h3>
            {weather ? (
              <div className="weather-content">
                <div>
                  <p>{weather.name}</p>
                  {currentDate && <p>{currentDate}</p>}
                  {currentTime && <p>{currentTime}</p>}
                  <p>{weather.main.temp}°C</p>
                  <p>{weather.weather[0].description}</p>
                </div>
                <img
                  src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`}
                  alt="Weather icon"
                  style={{ width: "180px", height: "180px" }}
                />
              </div>
            ) : (
              <p>Loading weather...</p>
            )}
          </div>

          <div className="soil">
            <h3>Soil Moisture</h3>
            <div className="graph-placeholder"></div>
          </div>
        </div>

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

function StatCard({ title, value }) {
  return (
    <div className="card">
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}
