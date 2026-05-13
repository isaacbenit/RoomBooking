import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rb_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Will be set by AuthProvider after mount
let _expireSession = null;
export function setExpireSessionHandler(fn) {
  _expireSession = fn;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    // 1. If it's a 401 on the password route, just pass the error to Profile.jsx
    if (status === 401 && url.includes('users/me/password')) {
      return Promise.reject(error);
    }

    // 2. For ANY OTHER 401, then it's a real session expiry
    if (status === 401) {
      // Assuming you have access to expireSession here, or just do it manually:
      localStorage.removeItem("rb_token");
      localStorage.removeItem("rb_user");

      // Force a reload to the login page to clear all React state safely
      window.location.href = "/login?expired=true";
    }

    return Promise.reject(error);
  }
);

export default api;
