import { BrowserRouter, Routes, Route } from "react-router-dom"; 
import LandingPage from "./components/LandingPage.jsx";  // ✅ import LandingPage
import RegisterPage from "./components/RegisterPage.jsx";
import FarmerPage from "./components/FarmerPage.jsx";
import RegisterFarmerPage from "./components/RegisterFarmerPage.jsx";
import LoginPage from "./components/LoginPage.jsx";
import DashboardPage from "./components/DashboardPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route shows LandingPage first */}
        <Route path="/" element={<LandingPage />} />

        {/* Other routes */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register-farmer" element={<RegisterFarmerPage />} />
        <Route path="/farmers" element={<FarmerPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Fallback route also shows LandingPage */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
