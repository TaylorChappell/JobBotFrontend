const SESSION_KEY = "applydesk_session";

declare global {
  interface Window { JOBBOT_CONFIG?: { API_URL?: string } }
}

export const API_BASE = (window.JOBBOT_CONFIG?.API_URL || import.meta.env.VITE_API_URL || "https://jobbotbackend-production.up.railway.app").replace(/\/$/, "");

export function getSession() {
  return localStorage.getItem(SESSION_KEY);
}

export function setSession(token: string) {
  localStorage.setItem(SESSION_KEY, token);
  window.dispatchEvent(new Event("applydesk-auth"));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("applydesk-auth"));
}

export function apiUrl(path: string) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = getSession();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(apiUrl(path), { ...options, headers });
  if (response.status === 401 && token) clearSession();
  return response;
}
