import { request } from './http'

export function runDiagnosis() {
  return request('/api/diagnosis', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}