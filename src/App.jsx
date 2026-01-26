import { BrowserRouter, Routes, Route } from "react-router-dom";
import RegisterPage from "./components/RegisterPage.jsx";
import FarmerPage from "./components/FarmerPage.jsx";
import RegisterFarmerPage from "./components/RegisterFarmerPage.jsx";
import LoginPage from "./components/LoginPage.jsx";
import DashboardPage from "./components/DashboardPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route shows RegisterPage */}
        <Route path="/" element={<RegisterPage />} />
                <Route path="/register-farmer" element={<RegisterFarmerPage />} />
        <Route path="/register-farmer-layout" element={<FarmerPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        {/* Fallback route */}
        <Route path="*" element={<RegisterPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
