import { request } from './http'

function authHeaders(token) {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}
}

export function register(username, password) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
    }),
  })
}

export function login(username, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
    }),
  })
}

export function getMe(token) {
  return request('/api/auth/me', {
    headers: authHeaders(token),
  })
}
