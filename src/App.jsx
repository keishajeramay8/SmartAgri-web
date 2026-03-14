// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import LandingPage from "./components/LandingPage.jsx";
import RegisterPage from "./components/RegisterPage.jsx";
import LoginPage from "./components/LoginPage.jsx";
import DashboardPage from "./components/DashboardPage.jsx";
import FarmerPage from "./components/FarmerPage.jsx";
import RegisterFarmerPage from "./components/RegisterFarmerPage.jsx";
import CreateFarmGroupPage from "./components/CreateFarmGroupPage.jsx";
import SoilMoisturePage from "./components/SoilMoisturePage.jsx";
import NotificationPage from "./components/NotificationPage.jsx";
import FarmGroup from "./components/FarmGroup.jsx";

import { auth, db, onMessageListener } from "./firebase"; // ✅ named import

function App() {
  const [fcmMessage, setFcmMessage] = useState(null);

  useEffect(() => {
    // Listen for FCM messages while app is in foreground
    const unsubscribe = onMessageListener((payload) => {
      console.log("FCM Message Received:", payload);
      setFcmMessage(payload);

      // Optional: show an alert
      alert(`New Notification:\n${payload.notification?.title}\n${payload.notification?.body}`);
    });

    return () => {
      unsubscribe && unsubscribe();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage fcmMessage={fcmMessage} />} />
        <Route path="/farmers" element={<FarmerPage />} />
        <Route path="/register-farmer" element={<RegisterFarmerPage />} />
        <Route path="/create-farm-group" element={<CreateFarmGroupPage />} />
        <Route path="/soil-status" element={<SoilMoisturePage />} />
        <Route path="/farm-group" element={<FarmGroup />} />
        <Route path="/notifications" element={<NotificationPage fcmMessage={fcmMessage} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;