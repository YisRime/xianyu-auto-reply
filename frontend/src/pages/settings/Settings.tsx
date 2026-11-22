/**
 * 系统设置页面。
 *
 * 功能模块按 Tab 展示，各卡片使用独立保存入口，避免跨模块覆盖未保存内容。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  getSystemSettings,
  normalizeLoginBrandingSettings,
  testEmailSend,
} from '@/api/settings'
import { PageLoading } from '@/components/common/Loading'
import { useRuntimeModeStore } from '@/store/runtimeModeStore'
import { useUIStore } from '@/store/uiStore'
import { getApiErrorMessage } from '@/utils/apiError'
import {
  applyThemeSettings,
  normalizeThemeAppearanceSettings,
  normalizeThemeFontSettings,
} from '@/utils/theme'
import type {
  LoginBrandingSettings,
  SystemSettings,
  ThemeAppearanceSettings,
  ThemeColorPreset,
  ThemeEffect,
  ThemeFontFamily,
  ThemeFontSettings,
} from '@/types'
import { AppearanceSettingsTab } from './AppearanceSettingsTab'
import { BasicSettingsTab } from './BasicSettingsTab'
import { ContactSettingsTab } from './ContactSettingsTab'
import { ServiceRestartCard } from './ServiceRestartCard'
import { SystemSettingsTabs } from './SystemSettingsTabs'
import { TestEmailModal } from './TestEmailModal'
import { UserNetworkSettingsTab } from './UserNetworkSettingsTab'
import { useSettingsActions } from './useSettingsActions'
import type { SettingsTab } from './settingsTypes'

export function Settings() {
  const { addToast } = useUIStore()
  const { setIsExeMode } = useRuntimeModeStore()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic')
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [showTestEmailModal, setShowTestEmailModal] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const settingsRef = useRef<SystemSettings | null>(null)

  settingsRef.current = settings
  const getCurrentSettings = useCallback(() => settingsRef.current, [])
  const actions = useSettingsActions(getCurrentSettings)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSystemSettings()
      if (!result.success || !result.data) {
        addToast({ type: 'error', message: '加载系统设置失败' })
        return
      }
      applyThemeSettings(result.data)
      setSettings(result.data)
      setIsExeMode(Boolean(result.data['runtime.is_exe_mode']))
    } catch (error) {
      addToast({ type: 'error', message: getApiErrorMessage(error, '加载系统设置失败') })
    } finally {
      setLoading(false)
    }
  }, [addToast, setIsExeMode])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleTestEmail = useCallback(async () => {
    const email = testEmail.trim()
    setSendingTestEmail(true)
    try {
      const result = await testEmailSend(email)
      if (result.success) {
        addToast({ type: 'success', message: result.message || '测试邮件发送成功' })
        setShowTestEmailModal(false)
        setTestEmail('')
      } else {
        addToast({ type: 'error', message: result.message || '发送测试邮件失败' })
      }
    } catch (error) {
      addToast({ type: 'error', message: getApiErrorMessage(error, '发送测试邮件失败') })
    } finally {
      setSendingTestEmail(false)
    }
  }, [addToast, testEmail])

  const handleThemeAppearanceChange = (key: keyof ThemeAppearanceSettings, value: ThemeEffect | ThemeColorPreset) => {
    setSettings((current) => {
      const next = { ...(current ?? {}), [key]: value }
      applyThemeSettings(next)
      return next
    })
  }

  const handleThemeFontChange = (key: keyof ThemeFontSettings, value: ThemeFontFamily) => {
    setSettings((current) => {
      const next = { ...(current ?? {}), [key]: value }
      applyThemeSettings(next)
      return next
    })
  }

  if (loading) return <PageLoading />

  const themeAppearance = normalizeThemeAppearanceSettings(settings)
  const themeFont = normalizeThemeFontSettings(settings)
  const loginBranding = normalizeLoginBrandingSettings(settings)

  return (
    <div className="space-y-4">
      <div className="page-header flex-between flex-wrap gap-4">
        <div><h1 className="page-title">系统设置</h1><p className="page-description">配置系统全局设置</p></div>
        <button type="button" onClick={() => void loadSettings()} className="btn-ios-secondary"><RefreshCw className="h-4 w-4" />刷新</button>
      </div>

      <SystemSettingsTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'basic' && <BasicSettingsTab
        settings={settings}
        setSettings={setSettings}
        basicSaving={actions.saving('basic')}
        onBasicSave={() => void actions.saveBasic()}
      />}

      {activeTab === 'contact' && <ContactSettingsTab
        settings={settings}
        setSettings={setSettings}
        smtpSaving={actions.saving('smtp')}
        onSmtpSave={() => void actions.saveSmtp()}
        onOpenTestEmail={() => setShowTestEmailModal(true)}
      />}

      {activeTab === 'appearance' && <AppearanceSettingsTab
        themeAppearanceSettings={themeAppearance}
        themeFontSettings={themeFont}
        loginBrandingSettings={loginBranding}
        themeAppearanceSaving={actions.saving('themeAppearance')}
        themeFontSaving={actions.saving('themeFont')}
        loginBrandingSaving={actions.saving('branding')}
        onThemeAppearanceChange={handleThemeAppearanceChange}
        onThemeAppearanceSave={() => void actions.saveThemeAppearance(themeAppearance)}
        onThemeFontChange={handleThemeFontChange}
        onThemeFontSave={() => void actions.saveThemeFont(themeFont)}
        onLoginBrandingChange={(key: keyof LoginBrandingSettings, value: string) => setSettings((current) => ({ ...(current ?? {}), [key]: value }))}
        onLoginBrandingSave={() => void actions.saveLoginBranding(loginBranding)}
      />}

      {activeTab === 'user' && <UserNetworkSettingsTab
        settings={settings}
        setSettings={setSettings}
        proxySaving={actions.saving('proxy')}
        onProxySave={() => void actions.saveProxy()}
      />}

      {activeTab === 'runtime' && <ServiceRestartCard />}

      {showTestEmailModal && <TestEmailModal email={testEmail} sending={sendingTestEmail} onChange={setTestEmail} onClose={() => { setShowTestEmailModal(false); setTestEmail('') }} onSend={() => void handleTestEmail()} />}
    </div>
  )
}
