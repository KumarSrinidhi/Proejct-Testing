import axios from "axios";

/**
 * API Configuration
 * 
 * Security: The API URL is configured via environment variable.
 * Environment variable: VITE_API_URL
 * Default: http://localhost:8000 (for development only)
 * 
 * To configure for production, set the VITE_API_URL environment variable:
 * VITE_API_URL=https://api.example.com npm run build
 */
const apiBaseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: apiBaseURL,
});

// Security: Add JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401 (optional enhancement)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retrying, attempt to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }
        
        const response = await axios.post(`${apiBaseURL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });
        
        localStorage.setItem("access_token", response.data.access_token);
        api.defaults.headers.common.Authorization = `Bearer ${response.data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (username, password) => api.post("/api/auth/login", { username, password }),
};

export const personApi = {
  list: (params = {}) => api.get("/api/persons", { params }),
  create: (payload) => api.post("/api/persons", payload),
  update: (id, payload) => api.put(`/api/persons/${id}`, payload),
  remove: (id) => api.delete(`/api/persons/${id}`),
  uploadImages: (id, formData) => api.post(`/api/persons/${id}/images`, formData),
  listImages: (id) => api.get(`/api/persons/${id}/images`),
  previewImage: (imageId) => api.get(`/api/images/${imageId}/preview`, { responseType: "blob" }),
  deleteImage: (imageId) => api.delete(`/api/images/${imageId}`),
};

export const attendanceApi = {
  list: (params = {}) => api.get("/api/attendance", { params }),
  update: (id, payload) => api.put(`/api/attendance/${id}`, payload),
  remove: (id) => api.delete(`/api/attendance/${id}`),
  today: () => api.get("/api/attendance/today"),
  heatmap: () => api.get("/api/attendance/heatmap"),
  trends: () => api.get("/api/attendance/trends"),
  exportCsv: (params = {}) => api.get("/api/attendance/export", { params, responseType: "blob" }),
};

export const trainingApi = {
  trigger: () => api.post("/api/train"),
  status: () => api.get("/api/train/status"),
  logs: () => api.get("/api/train/logs"),
  getLog: (id) => api.get(`/api/train/logs/${id}`),
  updateLog: (id, payload) => api.put(`/api/train/logs/${id}`, payload),
};

export const videoApi = {
  upload: (formData) => api.post("/api/video/upload", formData),
};

export default api;
