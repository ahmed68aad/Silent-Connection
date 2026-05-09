const SESSION_STORAGE_KEY = "silent-connection-session-id";
const DEFAULT_API_BASE_URL = import.meta.env.DEV
  ? ""
  : "https://silent-connection-production.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL;

function joinApiUrl(path) {
  if (path.startsWith("http")) return path;

  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const apiBaseUrl = baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const pathWithoutApiPrefix = normalizedPath.replace(/^\/api(?=\/|$)/, "");

  return `${apiBaseUrl}${pathWithoutApiPrefix}`;
}

export function resolveAssetUrl(path) {
  if (!path || path.startsWith("http") || path.startsWith("data:")) {
    return path;
  }

  const baseUrl = API_BASE_URL.replace(/\/+$/, "").replace(/\/api$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

function getSessionId() {
  if (typeof window === "undefined") return "";

  const existingSessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existingSessionId) return existingSessionId;

  const sessionId =
    window.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

async function request(path, options = {}) {
  const url = joinApiUrl(path);

  let response;

  try {
    response = await fetch(url, {
      ...options,
      // Required because server CORS is configured with credentials: true
      credentials: options.credentials || "include",
    });
  } catch (networkError) {
    throw new Error(
      "Could not reach the API. Make sure the backend is running.",
      {
        cause: networkError,
      },
    );
  }

  const responseText = await response.text().catch(() => "");
  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = {};
    }
  }

  if (!response.ok || data.success === false) {
    const error = new Error(
      data.message || `API request failed with status ${response.status}`,
    );

    error.code = data.code;
    error.status = response.status;
    error.responseData = data;
    throw error;
  }

  return data;
}

function authHeaders() {
  return {
    token: localStorage.getItem("token"),
    "X-Session-Id": getSessionId(),
  };
}

// ===== AUTH =====
export async function register(payload) {
  return request("/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function login(payload) {
  return request("/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getMe(token) {
  return request("/users/me", {
    headers: authHeaders(token),
  });
}

export async function updateProfileImage(token, formData) {
  return request("/users/profile-image", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

// ===== COUPLES =====
export async function getCoupleStatus(token) {
  return request("/couples/status", {
    headers: authHeaders(token),
  });
}

export async function connectCouple(token, inviteCode) {
  return request("/couples/connect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ inviteCode }),
  });
}

export async function disconnectCouple(token) {
  return request("/couples/disconnect", {
    method: "POST",
    headers: authHeaders(token),
  });
}

// ===== GROUPS =====
export async function getGroups(token) {
  return request("/groups", {
    headers: authHeaders(token),
  });
}

export async function createGroup(token, payload) {
  return request("/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export async function joinGroup(token, inviteCode) {
  return request("/groups/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ inviteCode }),
  });
}

export async function leaveGroup(token, groupId) {
  return request(`/groups/${groupId}/leave`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function transferGroupOwnership(token, groupId, targetCoupleId) {
  return request(`/groups/${groupId}/transfer-ownership`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ targetCoupleId }),
  });
}

export async function deleteGroup(token, groupId) {
  return request(`/groups/${groupId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// ===== POSTS =====
export async function getFeed(token, options = {}) {
  const params = new URLSearchParams({
    page: String(options.page || 1),
    limit: String(options.limit || 10),
  });

  if (options.feedType) params.set("feedType", options.feedType);
  if (options.groupId) params.set("groupId", options.groupId);

  return request(`/posts/feed?${params.toString()}`, {
    headers: authHeaders(token),
  });
}

export async function uploadPost(token, formData) {
  return request("/posts/upload", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

export async function deletePost(token, postId) {
  return request(`/posts/${postId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
