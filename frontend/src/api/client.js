import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// --- Token store: in-memory, mirrored to localStorage so a reload survives. ---
const STORAGE_KEY = 'dairydesk_auth'

let auth = loadAuth()

function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null
  } catch {
    return null
  }
}

export function getAuth() {
  return auth
}

export function setAuth(next) {
  auth = next
  if (next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export const api = axios.create({ baseURL: `${API_URL}/api` })

api.interceptors.request.use((config) => {
  if (auth?.access) {
    config.headers.Authorization = `Bearer ${auth.access}`
  }
  return config
})

// --- Refresh on 401 (single-flight so parallel requests refresh once). ---
let refreshPromise = null

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/api/auth/refresh/`, { refresh: auth.refresh })
      .then((res) => {
        setAuth({ ...auth, access: res.data.access })
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error
    if (response?.status === 401 && auth?.refresh && !config._retried) {
      config._retried = true
      try {
        await refreshAccessToken()
      } catch {
        // Refresh token dead — force a clean login.
        setAuth(null)
        window.location.assign('/login')
        return Promise.reject(error)
      }
      return api(config)
    }
    return Promise.reject(error)
  },
)

export async function login(username, password) {
  const res = await axios.post(`${API_URL}/api/auth/login/`, { username, password })
  const { access, refresh, username: name, role } = res.data
  setAuth({ access, refresh, user: { username: name, role } })
  return { username: name, role }
}

export function logout() {
  setAuth(null)
}

/** Flatten a DRF error payload into a readable message. */
export function apiErrorMessage(error) {
  const data = error.response?.data
  if (!data) return error.message || 'Request failed.'
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  return Object.entries(data)
    .map(([field, messages]) => {
      const text = Array.isArray(messages) ? messages.join(' ') : String(messages)
      return field === 'non_field_errors' || field === 'items' ? text : `${field}: ${text}`
    })
    .join(' ')
}
