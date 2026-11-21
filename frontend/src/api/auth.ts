import { post, get } from '@/utils/request'

import { normalizeLoginBrandingSettings } from '@/api/settings'
import type { LoginBrandingSettings, LoginResponse, ApiResponse } from '@/types'

const AUTH_PREFIX = '/api/v1/auth'
const SYSTEM_PREFIX = '/api/v1/system-settings'

// 缓存公共设置，避免重复请求
let publicSettingsCache: Record<string, unknown> | null = null
let publicSettingsPromise: Promise<Record<string, unknown>> | null = null

/**
 * 获取公共系统设置（带缓存）
 * 同一页面生命周期内只请求一次
 */
const getPublicSettings = async (): Promise<Record<string, unknown>> => {
  // 如果已有缓存，直接返回
  if (publicSettingsCache) {
    return publicSettingsCache
  }
  // 如果正在请求中，等待该请求完成
  if (publicSettingsPromise) {
    return publicSettingsPromise
  }
  // 发起新请求
  publicSettingsPromise = get<Record<string, unknown>>(`${SYSTEM_PREFIX}/public`)
    .then((settings) => {
      publicSettingsCache = settings
      return settings
    })
    .finally(() => {
      publicSettingsPromise = null
    })
  return publicSettingsPromise
}

// 用户登录
export const localAutoLogin = (): Promise<LoginResponse> => {
  return post(`${AUTH_PREFIX}/local-auto-login`, {})
}

// 验证 Token
export const verifyToken = (): Promise<{ authenticated: boolean; user_id?: number; username?: string; is_admin?: boolean; account_limit?: number | null }> => {
  return get(`${AUTH_PREFIX}/verify`)
}

// 用户登出
export const getLoginBrandingSettings = async (): Promise<LoginBrandingSettings> => {
  const settings = await getPublicSettings()
  return normalizeLoginBrandingSettings(settings)
}

// 生成图形验证码
export const checkAdminDefaultPassword = (): Promise<ApiResponse<{ is_default: boolean }>> => {
  return get(`${AUTH_PREFIX}/check-default-password`)
}


// 发送重置密码验证码