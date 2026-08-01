export const API_URL = "https://bugtracker-3kyf.onrender.com/api";

// export const API_URL = "/api";

const TOKEN_KEY = "bugtracker.token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export function fetchBugs({ q = "", status = "" } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  return request(`/bugs?${params.toString()}`, { auth: false });
}

export function createBug(formData) {
  return request("/bugs", { method: "POST", body: formData });
}

export function updateBug(id, formData) {
  return request(`/bugs/${id}`, { method: "PUT", body: formData });
}

export function deleteBug(id) {
  return request(`/bugs/${id}`, { method: "DELETE" });
}

export function signup({ name, username, password }) {
  return request("/auth/signup", {
    method: "POST",
    auth: false,
    body: { name, username, password },
  });
}

export function login({ username, password }) {
  return request("/auth/login", {
    method: "POST",
    auth: false,
    body: { username, password },
  });
}

export function fetchMe() {
  return request("/auth/me");
}

export function fetchVerifiedUsers() {
  return request("/users/verified");
}

export function fetchActions() {
  return request("/actions");
}

export function fetchUsers() {
  return request("/admin/users");
}

export function updateUser(id, patch) {
  return request(`/admin/users/${id}`, { method: "PATCH", body: patch });
}

export function deleteUser(id) {
  return request(`/admin/users/${id}`, { method: "DELETE" });
}

export function deleteActions({ from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request(`/actions?${params.toString()}`, { method: "DELETE" });
}
