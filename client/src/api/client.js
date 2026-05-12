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
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && _expireSession) {
      // Only expire if we actually had a token (not a fresh login failure)
      const hadToken = Boolean(localStorage.getItem("rb_token"));
      if (hadToken) _expireSession();
    }
    return Promise.reject(err);
  }
);

export default api;
