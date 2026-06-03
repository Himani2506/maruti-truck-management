import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const api = axios.create({ baseURL: `${BASE_URL}/api` });
// ...
return `${BASE_URL}/api/trips/export/excel${params ? '?' + params : ''}`;

// ── Master data ──────────────────────────────────────────────
export const getTrucks    = ()  => api.get('/trucks').then(r => r.data);
export const getSources   = ()  => api.get('/sources').then(r => r.data);
export const getCustomers = ()  => api.get('/customers').then(r => r.data);
export const getBackloads = ()  => api.get('/backloads').then(r => r.data);

// ── Distance ─────────────────────────────────────────────────
export const getDistance = (origin_lat, origin_lng, dest_lat, dest_lng) =>
  api.get('/distance', { params: { origin_lat, origin_lng, dest_lat, dest_lng } })
     .then(r => r.data);

// ── Trips ─────────────────────────────────────────────────────
export const getTrips  = (filters = {}) => api.get('/trips',  { params: filters }).then(r => r.data);
export const getTrip   = (id)           => api.get(`/trips/${id}`).then(r => r.data);
export const createTrip = (data)        => api.post('/trips', data).then(r => r.data);
export const updateTrip = (id, data)    => api.patch(`/trips/${id}`, data).then(r => r.data);
export const verifyTrip = (id)          => api.patch(`/trips/${id}/verify`).then(r => r.data);

export const getExportUrl = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return `http://localhost:4000/api/trips/export/excel${params ? '?' + params : ''}`;
};
