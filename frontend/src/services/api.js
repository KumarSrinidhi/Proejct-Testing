import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
