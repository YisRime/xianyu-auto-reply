import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'

const REQUEST_TIMEOUT = 90000

// 创建 axios 实例（单用户本地部署，不再附带登录令牌）
const request: AxiosInstance = axios.create({
  baseURL: '',
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.request.use(
  (config) => {
    // FormData 需要让浏览器自动设置 multipart/form-data + boundary，不能强制指定 JSON
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(error)
)

// 封装 GET 请求
export const get = async <T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await request.get<T>(url, config)
  return response.data
}

// 封装 POST 请求
export const post = async <T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await request.post<T>(url, data, config)
  return response.data
}

// 封装 PUT 请求
export const put = async <T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await request.put<T>(url, data, config)
  return response.data
}

// 封装 DELETE 请求
export const del = async <T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await request.delete<T>(url, config)
  return response.data
}

// 封装 PATCH 请求
export const patch = async <T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await request.patch<T>(url, data, config)
  return response.data
}

// 复用 utils/apiError.ts 的实现，保留 re-export 以兼容旧调用点
export { getApiErrorMessage } from './apiError'

export default request
