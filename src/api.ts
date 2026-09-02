const SESSION_KEY = "applydesk_session";

export const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

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
