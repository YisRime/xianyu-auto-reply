/**
 * 系统设置各模块的独立保存逻辑。
 *
 * 每个方法只提交当前模块相关键，避免一个保存按钮覆盖其它模块的未保存内容。
 */
import { useCallback, useState } from 'react'
import {
  updateLoginBrandingSettings,
  updateProxySettings,
  updateSystemSettings,
  updateThemeAppearanceSettings,
  updateThemeFontSettings,
} from '@/api/settings'
import { useUIStore } from '@/store/uiStore'
import { getApiErrorMessage } from '@/utils/apiError'
import { isValidEmail } from '@/utils/email'
import type {
  LoginBrandingSettings,
  SystemSettings,
  ThemeAppearanceSettings,
  ThemeFontSettings,
} from '@/types'

type SettingsGetter = () => SystemSettings | null

export function useSettingsActions(getSettings: SettingsGetter) {
  const { addToast } = useUIStore()
  const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set())

  const persist = useCallback(async (payload: Partial<SystemSettings>, successMessage: string, failureMessage: string) => {
    try {
      const result = await updateSystemSettings(payload)
      if (result.success) {
        addToast({ type: 'success', message: successMessage })
        return true
      }
      addToast({ type: 'error', message: result.message || failureMessage })
    } catch (error) {
      addToast({ type: 'error', message: getApiErrorMessage(error, failureMessage) })
    }
    return false
  }, [addToast])

  const run = useCallback(async (key: string, action: () => Promise<void>) => {
    setSavingKeys((current) => new Set(current).add(key))
    try {
      await action()
    } finally {
      setSavingKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }, [])

  const saveBasic = useCallback(async () => {
    const settings = getSettings()
    if (!settings) return
    const text = String(settings['log.retention_days'] ?? '7').trim()
    const value = Number(text)
    if (!text || !/^\d+$/.test(text) || !Number.isInteger(value) || value < 1 || value > 365) {
      addToast({ type: 'error', message: '日志保留天数必须为1到365之间的整数' })
      return
    }
    await run('basic', async () => {
      await persist({
        'log.retention_days': String(value),
        'account.face_verify_timeout_disable': Boolean(settings['account.face_verify_timeout_disable'] ?? true),
      }, '基础设置保存成功', '基础设置保存失败')
    })
  }, [addToast, getSettings, persist, run])

  const saveSmtp = useCallback(async () => {
    const settings = getSettings()
    if (!settings) return
    const port = Number(settings.smtp_port ?? 587)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      addToast({ type: 'error', message: 'SMTP端口必须为1到65535之间的整数' })
      return
    }
    const smtpUser = String(settings.smtp_user || '').trim()
    if (smtpUser && !isValidEmail(smtpUser)) {
      addToast({ type: 'error', message: '发件邮箱格式不正确' })
      return
    }
    await run('smtp', async () => {
      await persist({
        smtp_server: String(settings.smtp_server || ''),
        smtp_port: port,
        smtp_user: smtpUser,
        smtp_password: String(settings.smtp_password || ''),
        smtp_from: String(settings.smtp_from || ''),
      }, '发件人设置保存成功', '发件人设置保存失败')
    })
  }, [addToast, getSettings, persist, run])

  const saveProxy = useCallback(async () => {
    const settings = getSettings()
    if (!settings) return
    if (Boolean(settings['proxy.enabled']) && !String(settings['proxy.api_url'] || '').trim()) {
      addToast({ type: 'error', message: '开启代理前请先填写代理 API 的 URL' })
      return
    }
    await run('proxy', async () => {
      try {
        const result = await updateProxySettings(settings)
        addToast(result.success ? { type: 'success', message: result.message || '代理设置保存成功' } : { type: 'error', message: result.message || '代理设置保存失败' })
      } catch (error) {
        addToast({ type: 'error', message: getApiErrorMessage(error, '代理设置保存失败') })
      }
    })
  }, [addToast, getSettings, run])

  const saveSpecial = useCallback(async (key: string, action: () => Promise<{ success: boolean; message?: string }>, successMessage: string, failureMessage: string) => {
    await run(key, async () => {
      try {
        const result = await action()
        addToast(result.success ? { type: 'success', message: result.message || successMessage } : { type: 'error', message: result.message || failureMessage })
      } catch (error) {
        addToast({ type: 'error', message: getApiErrorMessage(error, failureMessage) })
      }
    })
  }, [addToast, run])

  return {
    saving: (key: string) => savingKeys.has(key),
    saveBasic,
    saveSmtp,
    saveProxy,
    saveLoginBranding: (settings: LoginBrandingSettings) => saveSpecial('branding', () => updateLoginBrandingSettings({ ...settings }), '登录品牌设置保存成功', '登录品牌设置保存失败'),
    saveThemeAppearance: (settings: ThemeAppearanceSettings) => saveSpecial('themeAppearance', () => updateThemeAppearanceSettings({ ...settings }), '主题外观保存成功', '主题外观保存失败'),
    saveThemeFont: (settings: ThemeFontSettings) => saveSpecial('themeFont', () => updateThemeFontSettings({ ...settings }), '主题字体保存成功', '主题字体保存失败'),
  }
}
