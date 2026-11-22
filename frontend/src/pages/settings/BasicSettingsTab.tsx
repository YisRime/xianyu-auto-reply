/** 基础与认证设置 Tab。 */
import { Save, Settings as SettingsIcon } from 'lucide-react'
import { ButtonLoading } from '@/components/common/Loading'
import type { SystemSettings } from '@/types'
import { RedeliveryKeywordSetting } from './RedeliveryKeywordSetting'
import { SliderModeSetting } from './SliderModeSetting'
import type { SetSystemSettings } from './settingsTypes'

interface BasicSettingsTabProps {
  settings: SystemSettings | null
  setSettings: SetSystemSettings
  basicSaving: boolean
  onBasicSave: () => void
}

export function BasicSettingsTab({
  settings,
  setSettings,
  basicSaving,
  onBasicSave,
}: BasicSettingsTabProps) {
  return (
    <div className="space-y-4">
      <div className="vben-card">
        <div className="vben-card-header">
          <h2 className="vben-card-title"><SettingsIcon className="h-4 w-4" />基础设置</h2>
        </div>
        <div className="vben-card-body space-y-4">
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <div className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-100 py-3 dark:border-slate-700">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">日志保留天数</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">所有模块日志保留天数，保存后生效（1~365天）</p>
              </div>
              <input
                type="number"
                min={1}
                max={365}
                value={settings?.['log.retention_days'] === undefined ? '7' : settings['log.retention_days']}
                onChange={(event) => {
                  const value = event.target.value
                  if (value === '' || /^\d+$/.test(value)) {
                    setSettings((current) => current ? { ...current, 'log.retention_days': value } : null)
                  }
                }}
                className="input-ios w-24 text-center"
              />
            </div>
            <ToggleSetting
              title="人脸验证超时自动禁用"
              description="关闭后人脸验证超时不会自动禁用账号"
              checked={Boolean(settings?.['account.face_verify_timeout_disable'] ?? true)}
              onChange={(checked) => setSettings((current) => current ? { ...current, 'account.face_verify_timeout_disable': checked } : null)}
              className="md:col-span-2"
            />
          </div>

          <SliderModeSetting
            value={settings?.['captcha.slider_mode']}
            onSaved={(mode) => setSettings((current) => current ? { ...current, 'captcha.slider_mode': mode } : current)}
          />
          <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-700">
            <button type="button" onClick={onBasicSave} disabled={basicSaving} className="btn-ios-primary">
              {basicSaving ? <ButtonLoading /> : <Save className="h-4 w-4" />}保存基础设置
            </button>
          </div>
        </div>
      </div>
      <RedeliveryKeywordSetting
        value={settings?.redelivery_trigger_keyword}
        onSaved={(keyword) => setSettings((current) => current ? { ...current, redelivery_trigger_keyword: keyword } : current)}
      />
    </div>
  )
}

interface ToggleSettingProps {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

function ToggleSetting({ title, description, checked, onChange, className = '' }: ToggleSettingProps) {
  return (
    <div className={`flex min-h-20 items-center justify-between gap-4 border-b border-slate-100 py-3 dark:border-slate-700 ${className}`}>
      <div>
        <p className="font-medium text-slate-900 dark:text-slate-100">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <label className="switch-ios">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="switch-slider" />
      </label>
    </div>
  )
}
