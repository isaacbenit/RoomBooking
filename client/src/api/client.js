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

    // 1. Check if it's a 401
    if (status === 401) {

      // 2. If it's the password update, STOP HERE.
      // Do NOT call expireSession(). Do NOT redirect.
      if (url.includes('users/me/password')) {
        return Promise.reject(error);
      }

      // 3. For any other 401, it means the token is actually expired.
      // This is where you call the function from your auth.jsx
      // Assuming you have access to the expireSession function here:
      console.warn("Real session expiry detected.");
      localStorage.removeItem("rb_token");
      localStorage.removeItem("rb_user");

      // This is likely what is currently triggering your redirect
      window.location.href = "/login?expired=true";
    }

    return Promise.reject(error);
  }
);

export default api;
