import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const videoApi = {
  ingest: (url) => api.post('/videos/ingest', { url }),
  getAll: () => api.get('/videos'),
  getById: (id) => api.get(`/videos/${id}`),
  getStatus: (videoId) => api.get(`/videos/status/${videoId}`),
  delete: (id) => api.delete(`/videos/${id}`),
};

export const sessionApi = {
  getBySessions: (videoId) => api.get(`/sessions/${videoId}`),
  getMessages: (sessionId) => api.get(`/sessions/${sessionId}/messages`),
  delete: (sessionId) => api.delete(`/sessions/${sessionId}`),
};

export default api;
