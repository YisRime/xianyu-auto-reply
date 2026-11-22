/**
 * 系统设置各模块的独立保存逻辑。
 *
 * 每个方法只提交当前模块相关键，避免一个保存按钮覆盖其它模块的未保存内容。
 */
import { useCallback, useState } from 'react'
import {
  buildHiddenMenuSettingsPayload,
  getHiddenMenuKeysFromSettings,
  updateDistributionSettings,
  updateLoginBrandingSettings,
  updateProxySettings,
  updateSystemSettings,
  updateThemeAppearanceSettings,
  updateThemeFontSettings,
} from '@/api/settings'
import { useMenuVisibilityStore } from '@/store/menuVisibilityStore'
import { useUIStore } from '@/store/uiStore'
import { getApiErrorMessage } from '@/utils/apiError'
import { isValidEmail } from '@/utils/email'
import type {
  LoginBrandingSettings,
  PaymentChannel,
  SystemSettings,
  ThemeAppearanceSettings,
  ThemeFontSettings,
} from '@/types'

type SettingsGetter = () => SystemSettings | null

export function useSettingsActions(getSettings: SettingsGetter) {
  const { addToast } = useUIStore()
  const { setHiddenMenuKeys } = useMenuVisibilityStore()
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
        registration_enabled: Boolean(settings.registration_enabled),
        show_default_login_info: Boolean(settings.show_default_login_info),
        login_captcha_enabled: Boolean(settings.login_captcha_enabled ?? true),
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
        'auth.email_allowed_suffixes': String(settings['auth.email_allowed_suffixes'] ?? ''),
        'auth.email_denied_suffixes': String(settings['auth.email_denied_suffixes'] ?? ''),
        'auth.email_denied_message': String(settings['auth.email_denied_message'] ?? ''),
      }, '发件人设置保存成功', '发件人设置保存失败')
    })
  }, [addToast, getSettings, persist, run])

  const savePayment = useCallback(async () => {
    const settings = getSettings()
    if (!settings) return
    const channel = String(settings['payment.channel'] || 'alipay') as PaymentChannel
    const payload: Partial<SystemSettings> = channel === 'zzcode'
      ? { 'payment.channel': channel, 'zzcode.pid': String(settings['zzcode.pid'] || ''), 'zzcode.key': String(settings['zzcode.key'] || ''), 'zzcode.gateway': String(settings['zzcode.gateway'] || ''), 'zzcode.notify_url': String(settings['zzcode.notify_url'] || ''), 'zzcode.return_url': String(settings['zzcode.return_url'] || ''), 'zzcode.pay_types': String(settings['zzcode.pay_types'] || '') }
      : { 'payment.channel': channel, 'alipay.app_id': String(settings['alipay.app_id'] || ''), 'alipay.gateway_url': String(settings['alipay.gateway_url'] || ''), 'alipay.private_key': String(settings['alipay.private_key'] || ''), 'alipay.alipay_public_key': String(settings['alipay.alipay_public_key'] || ''), 'alipay.notify_url': String(settings['alipay.notify_url'] || '') }
    await run('payment', async () => {
      await persist(payload, '支付配置保存成功', '支付配置保存失败')
    })
  }, [getSettings, persist, run])

  const saveWithdraw = useCallback(async () => {
    const settings = getSettings()
    if (!settings) return
    const notifyEmail = String(settings['withdraw.notify_email'] || '').trim()
    if (notifyEmail && !isValidEmail(notifyEmail)) {
      addToast({ type: 'error', message: '提现通知邮箱格式不正确' })
      return
    }
    const minAmount = String(settings['withdraw.min_amount'] || '').trim()
    if (minAmount && (!/^\d+(\.\d{1,2})?$/.test(minAmount) || Number(minAmount) < 0)) {
      addToast({ type: 'error', message: '最低提现金额必须为非负数字（最多两位小数）' })
      return
    }
    await run('withdraw', async () => { await persist({ 'withdraw.notify_email': notifyEmail, 'withdraw.min_amount': minAmount }, '提现配置保存成功', '提现配置保存失败') })
  }, [addToast, getSettings, persist, run])

  const saveDistribution = useCallback(async () => {
    const settings = getSettings()
    if (!settings) return
    const feeType = String(settings['distribution.fee_type'] || 'fixed')
    const feeRate = String(settings['distribution.fee_rate'] || '').trim()
    if (!['fixed', 'percent'].includes(feeType)) {
      addToast({ type: 'error', message: '手续费类型无效，请重新选择' })
      return
    }
    if (feeRate && (!/^\d+(\.\d{1,2})?$/.test(feeRate) || Number(feeRate) < 0)) {
      addToast({ type: 'error', message: '手续费必须为非负数字（最多两位小数）' })
      return
    }
    await run('distribution', async () => {
      try {
        const result = await updateDistributionSettings({ 'distribution.fee_type': feeType, 'distribution.fee_rate': feeRate })
        addToast(result.success ? { type: 'success', message: result.message || '分销设置保存成功' } : { type: 'error', message: result.message || '分销设置保存失败' })
      } catch (error) {
        addToast({ type: 'error', message: getApiErrorMessage(error, '分销设置保存失败') })
      }
    })
  }, [addToast, getSettings, run])

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

  const saveHiddenMenus = useCallback(async () => {
    const settings = getSettings()
    if (!settings || savingKeys.has('menus')) return
    const keys = getHiddenMenuKeysFromSettings(settings)
    await run('menus', async () => {
      if (await persist(buildHiddenMenuSettingsPayload(keys), '隐藏菜单设置保存成功', '隐藏菜单设置保存失败')) setHiddenMenuKeys(keys)
    })
  }, [getSettings, persist, run, savingKeys, setHiddenMenuKeys])

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
    savePayment,
    saveWithdraw,
    saveDistribution,
    saveProxy,
    saveHiddenMenus,
    saveLoginBranding: (settings: LoginBrandingSettings) => saveSpecial('branding', () => updateLoginBrandingSettings({ ...settings }), '登录品牌设置保存成功', '登录品牌设置保存失败'),
    saveThemeAppearance: (settings: ThemeAppearanceSettings) => saveSpecial('themeAppearance', () => updateThemeAppearanceSettings({ ...settings }), '主题外观保存成功', '主题外观保存失败'),
    saveThemeFont: (settings: ThemeFontSettings) => saveSpecial('themeFont', () => updateThemeFontSettings({ ...settings }), '主题字体保存成功', '主题字体保存失败'),
  }
}
