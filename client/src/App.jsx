import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./layout/Navbar.jsx";
import Protected from "./routes/Protected.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import RequestAccess from "./pages/RequestAccess.jsx";
import RequestStatus from "./pages/RequestStatus.jsx";
import Rooms from "./pages/Rooms.jsx";
import RoomCalendar from "./pages/RoomCalendar.jsx";
import MyRequests from "./pages/MyRequests.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx"; // Keep this one!
import Profile from "./pages/Profile.jsx";

export default function App() {
  const { pathname } = useLocation();
  const showNavbar = pathname !== "/";

  return (
    <div className="min-h-dvh" style={{ background: "#F8F9FA" }}>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RequestAccess />} />
        <Route path="/request-status" element={<RequestStatus />} />

        <Route element={<Protected />}>
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:id" element={<RoomCalendar />} />
          <Route path="/my-requests" element={<MyRequests />} />
          <Route path="/profile" element={<Profile />} />

          <Route element={<Protected role="Admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}