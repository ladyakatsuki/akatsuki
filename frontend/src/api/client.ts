// Axios 实例：统一 baseURL、请求/响应拦截、错误处理

import axios from 'axios'
import { DEFAULT_API_URL } from '@/utils/constants'

const baseURL = import.meta.env.VITE_API_URL || DEFAULT_API_URL

export const http = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截：注入 playerId header（从 localStorage 读取）
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('trpg_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const playerId = localStorage.getItem('trpg_player_id')
    if (playerId) {
      config.headers['x-player-id'] = playerId
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截：解包 { ok, data } 信封，统一错误格式
http.interceptors.response.use(
  (response) => {
    // 后端统一返回 { ok: boolean, data?: T, error?: string }
    const body = response.data
    if (body && typeof body === 'object' && 'ok' in body) {
      if (body.ok) {
        return body.data
      }
      // 业务错误
      const message = body.error ?? '请求失败'
      console.error('[HTTP]', message)
      return Promise.reject(new Error(message))
    }
    // 非标准信封（如静态文件），原样返回
    return body
  },
  (error) => {
    const body = error.response?.data
    const message =
      (body && typeof body === 'object' && 'error' in body ? body.error : undefined) ??
      error.message ??
      '请求失败'
    console.error('[HTTP]', message)
    return Promise.reject(new Error(message))
  },
)

export default http
