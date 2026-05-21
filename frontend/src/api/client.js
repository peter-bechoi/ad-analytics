import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' })

export async function pingHealth() {
  await api.get('/health')
}

export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/upload', form)
  return data
}

export async function fetchSummary() {
  const { data } = await api.get('/summary')
  return data
}
