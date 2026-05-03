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
  withCredentials: true,
});

// Handle token refresh on 401 (optional enhancement)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || "");
    const isAuthRoute = requestUrl.includes("/api/auth/login")
      || requestUrl.includes("/api/auth/refresh")
      || requestUrl.includes("/api/auth/me")
      || requestUrl.includes("/api/auth/logout");

    // Never run refresh/redirect logic for auth endpoints themselves.
    if (isAuthRoute) {
      return Promise.reject(error);
    }
    
    // If 401 and not already retrying, attempt to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(
          `${apiBaseURL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken = refreshResponse?.data?.access_token;
        if (newToken) {
          localStorage.setItem("access_token", newToken);
        }
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login only if we are not already there.
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (username, password) => api.post("/api/auth/login", { username, password }),
  logout: () => api.post("/api/auth/logout"),
  me: () => api.get("/api/auth/me"),
};

export const personApi = {
  list: (params = {}) => api.get("/api/persons", { params }),
  create: (payload) => api.post("/api/persons", payload),
  update: (id, payload) => api.put(`/api/persons/${id}`, payload),
  remove: (id) => api.delete(`/api/persons/${id}`),
  uploadImages: (id, formData, options = {}) => api.post(`/api/persons/${id}/images`, formData, options),
  listImages: (id) => api.get(`/api/persons/${id}/images`),
  previewImage: (imageId) => api.get(`/api/images/${imageId}/preview`, { responseType: "blob" }),
  deleteImage: (imageId) => api.delete(`/api/images/${imageId}`),
};

export const attendanceApi = {
  list: (params = {}) => api.get("/api/attendance", { params }),
  listMine: (params = {}) => api.get("/api/attendance/mine", { params }),
  update: (id, payload) => api.put(`/api/attendance/${id}`, payload),
  remove: (id) => api.delete(`/api/attendance/${id}`),
  today: () => api.get("/api/attendance/today"),
  todayMine: () => api.get("/api/attendance/mine/today"),
  heatmap: () => api.get("/api/attendance/heatmap"),
  trends: () => api.get("/api/attendance/trends"),
  exportCsv: (params = {}) => api.get("/api/attendance/export", { params, responseType: "blob" }),
  /** Manually log attendance for a known person (teacher/admin only). */
  createManual: (payload) => api.post("/api/attendance/manual", payload),
};

export const attendanceExceptionApi = {
  list: (params = {}) => api.get("/api/attendance-exceptions", { params }),
  create: (payload) => api.post("/api/attendance-exceptions", payload),
};

export const userApi = {
  list: (params = {}) => api.get("/api/users", { params }),
  create: (payload) => api.post("/api/users", payload),
  updateRole: (id, role) => api.put(`/api/users/${id}/role`, { role }),
  updatePassword: (id, password) => api.put(`/api/users/${id}/password`, { password }),
  remove: (id) => api.delete(`/api/users/${id}`),
};

export const trainingApi = {
  trigger: () => api.post("/api/train"),
  status: () => api.get("/api/train/status"),
  logs: (params = {}) => api.get("/api/train/logs", { params }),
  getLog: (id) => api.get(`/api/train/logs/${id}`),
  updateLog: (id, payload) => api.put(`/api/train/logs/${id}`, payload),
};

export const auditApi = {
  list: (params = {}) => api.get("/api/audit-logs", { params }),
};

export const videoApi = {
  upload: (formData, options = {}) => api.post("/api/video/upload", formData, options),
};

export const undetectedFaceApi = {
  list: (params = {}) => api.get("/api/undetected-faces", { params }),
  preview: (id) => api.get(`/api/undetected-faces/${id}/preview`, { responseType: "blob" }),
  remove: (id) => api.delete(`/api/undetected-faces/${id}`),
  updateReview: (id, payload) => api.put(`/api/undetected-faces/${id}/review`, payload),
  cleanup: () => api.post("/api/undetected-faces/cleanup"),
};

export default api;
