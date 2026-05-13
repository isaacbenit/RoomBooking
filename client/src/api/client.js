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
    // Check if it's a 401 error
    if (error.response?.status === 401) {

      // NEW: Check if the request was for the password update
      // If it is, DON'T redirect. Let the Profile page handle the error.
      if (error.config.url.includes('/api/users/me/password')) {
        return Promise.reject(error);
      }

      // Existing logic: Redirect to login for everything else
      console.warn("Session expired, redirecting...");
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
