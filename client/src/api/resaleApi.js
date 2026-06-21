import { request } from './http'

export function generateResaleCopy(itemId) {
  return request('/api/resale-copy', {
    method: 'POST',
    body: JSON.stringify({
      itemId: Number(itemId),
    }),
  })
}