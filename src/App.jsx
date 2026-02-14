import { BrowserRouter, Routes, Route } from "react-router-dom"; 
import LandingPage from "./components/LandingPage.jsx";
import RegisterPage from "./components/RegisterPage.jsx";
import FarmerPage from "./components/FarmerPage.jsx";
import RegisterFarmerPage from "./components/RegisterFarmerPage.jsx";
import LoginPage from "./components/LoginPage.jsx";
import DashboardPage from "./components/DashboardPage.jsx";
import CreateFarmGroupPage from "./components/CreateFarmGroupPage.jsx";
import SoilMoisturePage from "./components/SoilMoisturePage.jsx"; // ✅ added

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Farmer Pages */}
        <Route path="/register-farmer" element={<RegisterFarmerPage />} />
        <Route path="/farmers" element={<FarmerPage />} />

        {/* Soil Moisture Page */}
        <Route path="/soil-status" element={<SoilMoisturePage />} /> {/* ✅ added */}

        {/* Farm Group Page */}
        <Route path="/create-farm-group" element={<CreateFarmGroupPage />} />

        {/* Fallback */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
