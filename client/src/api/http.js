function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

export function getApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL

  if (typeof window === 'undefined') {
    return envBaseUrl || 'http://localhost:3001'
  }

  const pageHostname = window.location.hostname
  const pageProtocol = window.location.protocol || 'http:'

  if (!envBaseUrl) {
    return `${pageProtocol}//${pageHostname}:3001`
  }

  try {
    const apiUrl = new URL(envBaseUrl)

    if (!isLocalHostname(pageHostname) && isLocalHostname(apiUrl.hostname)) {
      apiUrl.hostname = pageHostname
    }

    return apiUrl.toString().replace(/\/$/, '')
  } catch {
    return envBaseUrl.replace(/\/$/, '')
  }
}

export async function request(path, options = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(data?.message || '请求失败')
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}
