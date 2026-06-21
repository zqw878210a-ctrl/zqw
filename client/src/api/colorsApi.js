import { request } from './http'

export function getColors() {
  return request('/api/colors')
}