import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const api = axios.create({ baseURL: `${BASE_URL}/api` });

// ── Master data ──────────────────────────────────────────────
export const getTrucks    = ()  => api.get('/trucks').then(r => r.data);
export const getSources   = ()  => api.get('/sources').then(r => r.data);
export const getCustomers = ()  => api.get('/customers').then(r => r.data);
export const getBackloads = ()  => api.get('/backloads').then(r => r.data);


// ── Trips ─────────────────────────────────────────────────────
export const getTrips  = (filters = {}) => api.get('/trips',  { params: filters }).then(r => r.data);
export const getTrip   = (id)           => api.get(`/trips/${id}`).then(r => r.data);
export const createTrip = (data)        => api.post('/trips', data).then(r => r.data);
export const updateTrip = (id, data)    => api.patch(`/trips/${id}`, data).then(r => r.data);
export const verifyTrip = (id)          => api.patch(`/trips/${id}/verify`).then(r => r.data);

// ── Scrap ─────────────────────────────────────────────────────
export const getScrapEntries   = ()         => api.get('/scrap').then(r => r.data);
export const getScrapPartySummary = ()      => api.get('/scrap/party-summary').then(r => r.data);
export const getSources = () =>
  fetch(`${API}/sources`).then(r => r.json());
export const createScrapEntry  = (data)     => api.post('/scrap', data).then(r => r.data);
export const updateScrapEntry    = (id, data) => api.put(`/scrap/${id}`, data).then(r => r.data);
export const overrideScrapEntry = (id, data) => api.put(`/scrap/${id}/override`, data).then(r => r.data);
export const deleteScrapEntry  = (id)       => api.delete(`/scrap/${id}`).then(r => r.data);
export const getScrapPartySheet  = (name)     => api.get(`/scrap/party-sheet/${encodeURIComponent(name)}`).then(r => r.data);
export const createBackload = (data) =>
  api.post("/backloads", data).then((r) => r.data);
export const createCustomer = (data) =>
  api.post("/customers", data).then((r) => r.data);



export const getExportUrl = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return `${BASE_URL}/api/trips/export/excel${params ? '?' + params : ''}`;
};

export const getCustomerRates = () => api.get('/customers/rates').then(r => r.data);