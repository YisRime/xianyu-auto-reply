import { Type, Save } from 'lucide-react'
import { ButtonLoading } from '@/components/common/Loading'
import type { LoginBrandingSettings } from '@/types'

interface LoginBrandingSettingsCardProps {
  settings: LoginBrandingSettings
  saving: boolean
  onChange: (key: keyof LoginBrandingSettings, value: string) => void
  onSave: () => void
}

/** 系统名称设置：用于侧边栏标题与浏览器标题。 */
export function LoginBrandingSettingsCard({ settings, saving, onChange, onSave }: LoginBrandingSettingsCardProps) {
  return (
    <div className="vben-card">
      <div className="vben-card-header flex items-center justify-between gap-3">
        <h2 className="vben-card-title">
          <Type className="w-4 h-4 text-blue-500" />
          系统名称
        </h2>
        <button onClick={onSave} disabled={saving} className="btn-ios-primary">
          {saving ? <ButtonLoading /> : <Save className="w-4 h-4" />}
          保存
        </button>
      </div>
      <div className="vben-card-body space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          显示在左侧边栏顶部。
        </p>
        <div className="input-group">
          <label className="input-label">系统名称</label>
          <input
            type="text"
            value={settings['login.system_name']}
            onChange={(event) => onChange('login.system_name', event.target.value)}
            placeholder="请输入系统名称"
            className="input-ios"
          />
        </div>
      </div>
    </div>
  )
}
