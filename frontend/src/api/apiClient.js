const BASE_URL = "http://localhost:4000/api";

const getAccessToken = () => {
  try {
    return localStorage.getItem("accessToken");
  } catch {
    return null;
  }
};

const buildHeaders = (hasBody = false) => {
  const headers = {};
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const normalizeBackendError = (payload, fallbackMessage) => {
  const backendMessage =
    payload?.error?.message ||
    payload?.message ||
    fallbackMessage ||
    "Request failed";

  const error = new Error(String(backendMessage));
  error.code = payload?.error?.code || "API_ERROR";
  error.details = payload?.error?.details ?? null;
  error.payload = payload ?? null;
  return error;
};

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const parseResponsePayload = async (response) => {
  const payload = await safeJson(response);

  if (payload && typeof payload.success === "boolean") {
    if (payload.success) {
      const data =
        payload.data !== undefined && payload.data !== null ? payload.data : payload;
      return { ok: true, payload, data };
    }
    throw normalizeBackendError(payload, "Request failed");
  }

  if (response.ok) {
    return { ok: true, payload, data: payload };
  }

  throw normalizeBackendError(payload, `HTTP ${response.status}`);
};

const request = async (method, url, body) => {
  const fullUrl = `${BASE_URL}${url}`;
  const hasBody = body !== undefined && body !== null;

  let response;
  try {
    response = await fetch(fullUrl, {
      method,
      headers: buildHeaders(hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Network error");
  }

  const { data } = await parseResponsePayload(response);
  return data;
};

/** multipart/form-data (do not set Content-Type; browser sets boundary) */
const postFormData = async (url, formData) => {
  const fullUrl = `${BASE_URL}${url}`;
  const headers = {};
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(fullUrl, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch {
    throw new Error("Network error");
  }

  const { data } = await parseResponsePayload(response);
  return data;
};

const deleteWithBody = async (url, body) => {
  const fullUrl = `${BASE_URL}${url}`;
  const headers = buildHeaders(true);

  let response;
  try {
    response = await fetch(fullUrl, {
      method: "DELETE",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error");
  }

  const { data } = await parseResponsePayload(response);
  return data;
};

const get = (url) => request("GET", url);
const post = (url, body) => request("POST", url, body);
const put = (url, body) => request("PUT", url, body);
const patch = (url, body) => request("PATCH", url, body);
const del = (url) => request("DELETE", url);

export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
  postFormData,
  deleteWithBody,
};

export { get, post, put, patch, del as deleteRequest };

