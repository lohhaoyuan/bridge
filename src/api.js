import { reactive } from 'vue';

const read = () => {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
};

// account: null until loaded or when signed out. ready: the first /auth/me check finished.
export const auth = reactive({ token: read(), account: null, ready: false });

function setToken(token) {
  auth.token = token;
  if (!token) auth.account = null;
  try {
    token ? localStorage.setItem('token', token) : localStorage.removeItem('token');
  } catch {}
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401 && auth.token && !path.startsWith('/auth/')) setToken(null);
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

export async function loadAccount() {
  try {
    auth.account = auth.token ? await api('/auth/me') : null;
  } catch {
    setToken(null);
  } finally {
    auth.ready = true;
  }
}

export async function acceptToken(token) {
  setToken(token);
  await loadAccount();
}

export async function signInWith(path, body) {
  const { token } = await api(path, { method: 'POST', body });
  await acceptToken(token);
}

export async function signOut() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  setToken(null);
}

let metaPromise;
export const getMeta = () => (metaPromise ??= api('/meta'));

export const formatDate = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
