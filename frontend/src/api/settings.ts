import { get, post, put } from '@/utils/request'
import type {
  ApiResponse,
  LoginBrandingSettings,
  SystemSettings,
  ThemeAppearanceSettings,
  ThemeFontSettings,
} from '@/types'
import {
  dispatchThemeSettingsUpdated,
  normalizeThemeAppearanceSettings,
  normalizeThemeFontSettings,
} from '@/utils/theme'
import {
  updateSystemSettings,
  updateSystemSettingsBatch,
} from './systemSettingsBatch'

export { updateSystemSettings, updateSystemSettingsBatch } from './systemSettingsBatch'

// API前缀
const SYSTEM_SETTINGS_PREFIX = '/api/v1/system-settings'
const PUBLIC_SYSTEM_SETTINGS_PREFIX = `${SYSTEM_SETTINGS_PREFIX}/public`
const AI_SETTINGS_PREFIX = '/api/v1/ai-reply-settings'
const ADMIN_PREFIX = '/api/v1/admin'
const USERS_PREFIX = '/api/v1/users'
const MENU_HIDDEN_SETTING_KEY = 'navigation.hidden_menu_keys'
const DEFAULT_LOGIN_BRANDING_SETTINGS: LoginBrandingSettings = {
  'login.system_name': '闲鱼管理系统',
  'login.system_title': '高效专业的\n闲鱼自动化管理平台',
  'login.system_description': '自动回复、智能客服、订单管理、数据分析，一站式解决闲鱼运营难题',
}

const LOGIN_BRANDING_SETTING_KEYS: Array<keyof LoginBrandingSettings> = [
  'login.system_name',
  'login.system_title',
  'login.system_description',
]

const BOOLEAN_SYSTEM_SETTING_KEYS = ['registration_enabled', 'show_default_login_info', 'login_captcha_enabled', 'smtp_use_tls', 'smtp_use_ssl', 'runtime.is_exe_mode', 'account.face_verify_timeout_disable', 'proxy.enabled']

export const LOGIN_BRANDING_UPDATED_EVENT = 'login-branding-updated'

const convertSystemSettings = (data: Record<string, unknown>): SystemSettings => {
  const converted: SystemSettings = {}
  for (const [key, value] of Object.entries(data)) {
    if (BOOLEAN_SYSTEM_SETTING_KEYS.includes(key)) {
      converted[key] = value === true || value === 'true'
    } else {
      converted[key] = value
    }
  }
  return converted
}

// 获取系统设置
export const getSystemSettings = async (): Promise<{ success: boolean; data?: SystemSettings }> => {
  const data = await get<Record<string, unknown>>(SYSTEM_SETTINGS_PREFIX)
  return { success: true, data: convertSystemSettings(data) }
}

export const getPublicSystemSettings = async (): Promise<{ success: boolean; data?: SystemSettings }> => {
  const data = await get<Record<string, unknown>>(PUBLIC_SYSTEM_SETTINGS_PREFIX)
  return { success: true, data: convertSystemSettings(data) }
}

export const getDefaultLoginBrandingSettings = (): LoginBrandingSettings => ({ ...DEFAULT_LOGIN_BRANDING_SETTINGS })

export const normalizeLoginBrandingSettings = (settings?: Partial<SystemSettings> | null): LoginBrandingSettings => {
  const systemName = settings?.['login.system_name']
  const systemTitle = settings?.['login.system_title']
  const systemDescription = settings?.['login.system_description']

  return {
    'login.system_name': typeof systemName === 'string' && systemName.trim() ? systemName : DEFAULT_LOGIN_BRANDING_SETTINGS['login.system_name'],
    'login.system_title': typeof systemTitle === 'string' && systemTitle.trim() ? systemTitle : DEFAULT_LOGIN_BRANDING_SETTINGS['login.system_title'],
    'login.system_description': typeof systemDescription === 'string' && systemDescription.trim() ? systemDescription : DEFAULT_LOGIN_BRANDING_SETTINGS['login.system_description'],
  }
}

export const dispatchLoginBrandingUpdated = (settings?: Partial<SystemSettings> | null): void => {
  if (typeof window === 'undefined') {
    return
  }

  const normalized = normalizeLoginBrandingSettings(settings)
  window.dispatchEvent(new CustomEvent<LoginBrandingSettings>(LOGIN_BRANDING_UPDATED_EVENT, { detail: normalized }))
}

export const buildLoginBrandingSettingsPayload = (settings?: Partial<SystemSettings> | null): LoginBrandingSettings => {
  const normalized = normalizeLoginBrandingSettings(settings)
  return LOGIN_BRANDING_SETTING_KEYS.reduce((payload, key) => {
    payload[key] = normalized[key]
    return payload
  }, {} as LoginBrandingSettings)
}

export const updateLoginBrandingSettings = async (settings?: Partial<SystemSettings> | null): Promise<ApiResponse> => {
  const response = await updateSystemSettings(buildLoginBrandingSettingsPayload(settings) as Partial<SystemSettings>)
  if (response.success) {
    dispatchLoginBrandingUpdated(settings)
  }
  return response
}

export const buildThemeAppearanceSettingsPayload = (settings?: Partial<SystemSettings> | null): ThemeAppearanceSettings => {
  const normalized = normalizeThemeAppearanceSettings(settings)
  return {
    'theme.effect': normalized['theme.effect'],
    'theme.color_preset': normalized['theme.color_preset'],
  }
}

export const updateThemeAppearanceSettings = async (settings?: Partial<SystemSettings> | null): Promise<ApiResponse> => {
  const payload = buildThemeAppearanceSettingsPayload(settings)
  const response = await updateSystemSettings(payload as Partial<SystemSettings>)
  if (response.success) {
    dispatchThemeSettingsUpdated(settings)
  }
  return response
}

export const buildThemeFontSettingsPayload = (settings?: Partial<SystemSettings> | null): ThemeFontSettings => {
  const normalized = normalizeThemeFontSettings(settings)
  return {
    'theme.font_family': normalized['theme.font_family'],
  }
}

export const updateThemeFontSettings = async (settings?: Partial<SystemSettings> | null): Promise<ApiResponse> => {
  const payload = buildThemeFontSettingsPayload(settings)
  const response = await updateSystemSettings(payload as Partial<SystemSettings>)
  if (response.success) {
    dispatchThemeSettingsUpdated(settings)
  }
  return response
}

export const parseHiddenMenuKeys = (value: unknown): string[] => {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value !== 'string') {
    return []
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return []
  }

  try {
    const parsed = JSON.parse(trimmedValue)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean)
    }
  } catch {
    return trimmedValue.split(',').map((item) => item.trim()).filter(Boolean)
  }

  return []
}

export const serializeHiddenMenuKeys = (keys: string[]): string => {
  return JSON.stringify(Array.from(new Set(keys.filter(Boolean))))
}

export const getHiddenMenuKeysFromSettings = (settings?: SystemSettings | null): string[] => {
  return parseHiddenMenuKeys(settings?.[MENU_HIDDEN_SETTING_KEY])
}

export const buildHiddenMenuSettingsPayload = (keys: string[]): Partial<SystemSettings> => {
  return {
    [MENU_HIDDEN_SETTING_KEY]: serializeHiddenMenuKeys(keys),
  }
}

// 获取 AI 设置
export const getAISettings = (): Promise<{ success: boolean; data?: Record<string, unknown> }> => {
  return get(AI_SETTINGS_PREFIX)
}

// 更新 AI 设置
export const updateAISettings = (data: Record<string, unknown>): Promise<ApiResponse> => {
  return put(AI_SETTINGS_PREFIX, data)
}

export const testEmailSend = async (email: string): Promise<ApiResponse> => {
  return post(`${SYSTEM_SETTINGS_PREFIX}/test-email?email=${encodeURIComponent(email)}`)
}

// ========== 代理设置（独立保存） ==========

export interface ProxySettingsPayload {
  'proxy.api_url': string
  'proxy.enabled': boolean
}

// 从全局 settings 中提取代理设置，兼容字符串/布尔回读
// enabled 在 BOOLEAN_SYSTEM_SETTING_KEYS 白名单中，convertSystemSettings 会把字符串 'true'/'false' 转成 boolean；
// 但 Partial<SystemSettings> 泛型意义下可能被外部传入未转换的原始值，这里用 unknown 宽泛判断兜底。
export const normalizeProxySettings = (settings?: Partial<SystemSettings> | null): ProxySettingsPayload => {
  const apiUrl = settings?.['proxy.api_url']
  const enabled = settings?.['proxy.enabled'] as unknown
  return {
    'proxy.api_url': typeof apiUrl === 'string' ? apiUrl : '',
    'proxy.enabled': enabled === true || enabled === 'true',
  }
}

// 独立保存代理设置：批量提交 URL 与开关，由后端按完整目标状态校验并在同一事务中保存。
export const updateProxySettings = async (settings?: Partial<SystemSettings> | null): Promise<ApiResponse> => {
  const normalized = normalizeProxySettings(settings)
  return updateSystemSettingsBatch(normalized as Partial<SystemSettings>)
}

// ========== 分销设置（独立保存） ==========

// 独立保存分销设置：只提交 distribution.* 相关键，不触碰其他设置
// 与页面右上角"保存设置"按钮分离，避免影响其他未改动的设置
export const updateDistributionSettings = async (settings?: Partial<SystemSettings> | null): Promise<ApiResponse> => {
  const feeType = settings?.['distribution.fee_type']
  const feeRate = settings?.['distribution.fee_rate']

  const payload: Record<string, string> = {
    'distribution.fee_type': typeof feeType === 'string' && feeType ? feeType : 'fixed',
    'distribution.fee_rate': typeof feeRate === 'string' ? feeRate : '',
  }

  return updateSystemSettingsBatch(payload as Partial<SystemSettings>)
}

// 修改密码
export const changePassword = async (data: { current_password: string; new_password: string }): Promise<ApiResponse> => {
  return post(`${USERS_PREFIX}/change-password`, data)
}

// 获取当前登录用户信息（含到期日）
export interface CurrentUserProfile {
  id: number
  username: string
  email?: string
  phone?: string
  role?: string
  status?: string
  account_limit?: number | null
  last_login_at?: string | null
  expire_at?: string | null
}

export const getCurrentUserProfile = async (): Promise<CurrentUserProfile> => {
  return get(`${USERS_PREFIX}/me`)
}

// 账户续期：按系统设置的续期单价扣减余额并延长到期日
export interface RenewMembershipResult {
  months: number
  unit_price: string
  total: string
  balance_before: string
  balance_after: string
  expire_at: string | null
}

export const renewMembership = async (months: number): Promise<ApiResponse<RenewMembershipResult>> => {
  return post(`${USERS_PREFIX}/renew`, { months })
}

// 获取备份文件列表（管理员）
export const getBackupList = async (): Promise<{ backups: Array<{ filename: string; size: number; size_mb: number; modified_time: string }>; total: number }> => {
  return get(`${ADMIN_PREFIX}/backup/list`)
}

// 下载数据库备份（管理员）
export const downloadDatabaseBackup = (): string => {
  const token = localStorage.getItem('auth_token')
  return `${ADMIN_PREFIX}/backup/download?token=${token}`
}

// 上传数据库备份（管理员）
export const uploadDatabaseBackup = async (file: File): Promise<ApiResponse> => {
  const formData = new FormData()
  formData.append('backup_file', file)
  return post(`${ADMIN_PREFIX}/backup/upload`, formData)
}

// 导出用户备份
export const exportUserBackup = (): string => {
  const token = localStorage.getItem('auth_token')
  return `/api/v1/backup/export?token=${token}`
}

// 导入用户备份
export const importUserBackup = async (file: File): Promise<ApiResponse> => {
  const formData = new FormData()
  formData.append('file', file)
  return post('/api/v1/backup/import', formData)
}

// ========== 用户设置 ==========

// 获取单个用户设置
export const getUserSetting = async (key: string): Promise<{ success: boolean; value?: string }> => {
  try {
    const data = await get<{ value: string }>(`/api/v1/user-settings/${key}`)
    return { success: true, value: data.value }
  } catch {
    return { success: false }
  }
}

// 更新用户设置
export const updateUserSetting = async (key: string, value: string, description?: string): Promise<ApiResponse> => {
  return put(`/api/v1/user-settings/${key}`, { value, description })
}

export interface LocationChatRemoteTestResult {
  success: boolean
  message?: string
  data?: {
    status_code?: number
    duration_ms?: number
    protocol_version?: string
  }
}

export const testLocationChatRemoteApi = async (
  url: string,
  secretKey: string,
): Promise<LocationChatRemoteTestResult> => {
  return post('/api/v1/user-settings/external-api/location-chat/test', {
    url,
    secret_key: secretKey,
  })
}



// ========== 群二维码管理 ==========

// 二维码类型
type QrcodeType = 'wechat' | 'qq' | 'wechat_official' | 'telegram' | 'reward'

// 上传群二维码（管理员）
export const uploadQrcode = async (type: QrcodeType, file: File): Promise<ApiResponse & { data?: { image_url: string } }> => {
  const formData = new FormData()
  formData.append('image', file)
  return post(`/api/v1/qrcode/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// 获取群二维码路径
export const getQrcodeUrl = async (type: QrcodeType): Promise<{ success: boolean; message?: string; data?: { image_url: string } }> => {
  return get(`/api/v1/qrcode/${type}`)
}
