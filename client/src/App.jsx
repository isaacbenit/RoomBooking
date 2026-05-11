import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./layout/Navbar.jsx";
import Protected from "./routes/Protected.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Rooms from "./pages/Rooms.jsx";
import RoomCalendar from "./pages/RoomCalendar.jsx";
import MyRequests from "./pages/MyRequests.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

export default function App() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<Protected />}>
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:id" element={<RoomCalendar />} />
          <Route path="/my-requests" element={<MyRequests />} />

          <Route element={<Protected role="Admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

