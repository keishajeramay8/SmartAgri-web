import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

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

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Landing */}
        <Route path="/" element={<LandingPage />} />

        {/* Authentication */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Sidebar Pages */}
        <Route path="/farmers" element={<FarmerPage />} />
        <Route path="/register-farmer" element={<RegisterFarmerPage />} />
        <Route path="/create-farm-group" element={<CreateFarmGroupPage />} />
        <Route path="/soil-status" element={<SoilMoisturePage />} />
        <Route path="/farm-group" element={<FarmGroup />} />

        {/* Notification */}
        <Route path="/notifications" element={<NotificationPage />} />

        {/* Unknown route → redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;