// Small fetch wrapper so every call shares JSON handling and error reporting.
// Throws an Error with .status set, so callers can branch on 429 etc.
async function request(path, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(path, {
    method,
    headers: body && !raw ? { 'Content-Type': 'application/json' } : undefined,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  get: path => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: path => request(path, { method: 'DELETE' }),
  // For FormData uploads: the browser sets the multipart headers itself
  upload: (path, formData) => request(path, { method: 'POST', body: formData, raw: true }),
};
