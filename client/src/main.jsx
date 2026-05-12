import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./state/auth.jsx";
import SessionExpiredBanner from "./layout/SessionExpiredBanner.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SessionExpiredBanner />
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
