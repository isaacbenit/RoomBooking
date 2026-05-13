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

    // Check if it's a 401 error
    if (status === 401) {

      // IMPROVED CHECK: Look for the specific endpoint keywords
      // This catches "/api/users/me/password" AND "/users/me/password"
      if (url.includes('users/me/password')) {
        console.log("401 on password update - allowing Profile page to handle it.");
        return Promise.reject(error);
      }

      // Only redirect if it's NOT the password route
      console.warn("Session expired, redirecting...");
      localStorage.removeItem("token");

      // Use a small check to prevent infinite redirect loops
      if (window.location.pathname !== "/login") {
        window.location.href = "/login?expired=true";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
