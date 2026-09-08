import axios from "axios";

const api = axios.create({
  baseURL:
    process.env.REACT_APP_API_URL ||
    "https://ai-wildlife-population-intelligence.onrender.com",
});

// Attach the token automatically so individual pages don't need to
// repeat `headers: { Authorization: ... }` on every single call.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token is invalid, expired, or the account was deactivated,
// clear it and send the user back to login instead of leaving the
// app stuck on silent 401/403 errors.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    if (status === 401) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;