const BASE_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = "odinbook_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  const isFormData = body instanceof FormData;

  // FormData must set its OWN Content-Type, because it has to include the
  // multipart boundary string. Setting it by hand breaks the upload.
  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body:
      body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (res.status === 204) return null; // No Content — nothing to parse

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // Re-shape the API's error envelope into a real Error, so every caller
    // can just use try/catch and read err.message / err.details.
    const err = new Error(data?.error?.message || "Something went wrong.");
    err.status = res.status;
    err.details = data?.error?.details;
    throw err;
  }

  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) =>
    request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};

// Turns the API's details array into { fieldName: message } for form inputs.
export function fieldErrors(err) {
  return Object.fromEntries(
    (err?.details ?? []).map((d) => [d.field, d.message]),
  );
}
