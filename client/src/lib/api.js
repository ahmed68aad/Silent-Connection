const SESSION_STORAGE_KEY = "silent-connection-session-id";

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

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

async function request(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const baseUrl =
    API_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const url = path.startsWith("http")
    ? path
    : baseUrl.endsWith("/api") && normalizedPath.startsWith("/api")
      ? `${baseUrl}${normalizedPath.slice(4)}`
      : `${baseUrl}${normalizedPath}`;

  let response;

  try {
    response = await fetch(url, options);
  } catch (networkError) {
    throw new Error(
      "Could not reach the API. Check backend URL and deployment.",
      { cause: networkError },
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
    const isVercelProtection =
      response.status === 403 &&
      /Vercel Security Checkpoint|Deployment Protection/i.test(responseText);

    const error = new Error(
      isVercelProtection
        ? "Vercel Deployment Protection is blocking the API."
        : data.message || `API request failed with status ${response.status}`,
    );

    error.code = data.code;
    error.status = response.status;
    error.responseData = data;
    throw error;
  }

  return data;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Session-Id": getSessionId(),
  };
}

// ===== AUTH =====
export async function register(payload) {
  return request("/api/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function login(payload) {
  return request("/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function resendVerification(email) {
  return request("/api/users/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmail(payload) {
  return request("/api/users/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getMe(token) {
  return request("/api/users/me", {
    headers: authHeaders(token),
  });
}

export async function updateProfileImage(token, formData) {
  return request("/api/users/profile-image", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

// ===== COUPLES =====
export async function getCoupleStatus(token) {
  return request("/api/couples/status", {
    headers: authHeaders(token),
  });
}

export async function connectCouple(token, inviteCode) {
  return request("/api/couples/connect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ inviteCode }),
  });
}

export async function disconnectCouple(token) {
  return request("/api/couples/disconnect", {
    method: "POST",
    headers: authHeaders(token),
  });
}

// ===== GROUPS =====
export async function getGroups(token) {
  return request("/api/groups", {
    headers: authHeaders(token),
  });
}

export async function createGroup(token, payload) {
  return request("/api/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export async function joinGroup(token, inviteCode) {
  return request("/api/groups/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ inviteCode }),
  });
}

export async function leaveGroup(token, groupId) {
  return request(`/api/groups/${groupId}/leave`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function transferGroupOwnership(token, groupId, targetCoupleId) {
  return request(`/api/groups/${groupId}/transfer-ownership`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ targetCoupleId }),
  });
}

export async function deleteGroup(token, groupId) {
  return request(`/api/groups/${groupId}`, {
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

  return request(`/api/posts/feed?${params.toString()}`, {
    headers: authHeaders(token),
  });
}

export async function uploadPost(token, formData) {
  return request("/api/posts/upload", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

export async function deletePost(token, postId) {
  return request(`/api/posts/${postId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
