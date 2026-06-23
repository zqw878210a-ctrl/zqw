import { request } from './http'

export function getWardrobe() {
  return request('/api/wardrobe')
}

export function createWardrobeItem(payload) {
  return request('/api/wardrobe', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function wearWardrobeItem(id) {
  return request(`/api/wardrobe/${id}/wear`, {
    method: 'POST',
  })
}

export function resetDemoWardrobe() {
  return request('/api/wardrobe/demo-reset', {
    method: 'POST',
  })
}

export function clearDemoWardrobe() {
  return request('/api/wardrobe/demo-clear', {
    method: 'POST',
  })
}

export function deleteWardrobeItem(id) {
  return request(`/api/wardrobe/${id}`, {
    method: 'DELETE',
  })
}
