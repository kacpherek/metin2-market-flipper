const CACHE_TTL_MS = 30_000
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const responseCache = new Map()
const requests = new Map()

function apiUrl(path) {
  if (!API_BASE || !path.startsWith('/api/')) return path
  return `${API_BASE}${path}`
}

function waitForRequest(request, signal) {
  if (!signal) return request
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    request.then(
      (value) => { signal.removeEventListener('abort', abort); resolve(value) },
      (error) => { signal.removeEventListener('abort', abort); reject(error) },
    )
  })
}

export function getJson(path, signal) {
  const cacheable = !path.includes('fresh=1')
  const cached = responseCache.get(path)
  if (cacheable && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return waitForRequest(Promise.resolve(cached.body), signal)
  }

  let request = requests.get(path)
  if (!request) {
    request = fetch(apiUrl(path))
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok || body.ok === false) throw new Error(body.error || `HTTP ${response.status}`)
        if (cacheable) responseCache.set(path, { at: Date.now(), body })
        return body
      })
      .finally(() => requests.delete(path))
    requests.set(path, request)
  }
  return waitForRequest(request, signal)
}

export const prefetchJson = (path) => getJson(path).catch(() => undefined)

export function query(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) search.set(key, value)
  })
  return search.toString()
}

export const fmt = (value) => Number(value || 0).toLocaleString('pl-PL')

export function compact(value) {
  return new Intl.NumberFormat('pl-PL', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
}

export function dateTime(value) {
  if (!value) return 'Brak danych'
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function confidenceTone(value) {
  if (value >= 80) return 'success'
  if (value >= 55) return 'warning'
  return 'destructive'
}
