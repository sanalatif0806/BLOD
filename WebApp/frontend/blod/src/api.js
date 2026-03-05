export const base_url = process.env.REACT_APP_API_URL || 'http://localhost:5005';
// In your Cloud.js component - fix the BASE_URL
//export const base_url = process.env.NODE_ENV === 'development'
//  ? 'http://localhost:5005'
//  : 'http://backend:5005';
export const kghb_url = 'https://kgheartbeat.di.unisa.it/kgheartbeat-api/'
export const dahboard_backend_url = process.env.REACT_APP_DASHBOARD_BACKEND||'http://localhost:5005'
//https://kgheartbeat.di.unisa.it/kgheartbeat-api