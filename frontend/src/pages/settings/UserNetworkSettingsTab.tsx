/** 网络与代理设置 Tab。 */
import { Globe, Save } from 'lucide-react'
import { ButtonLoading } from '@/components/common/Loading'
import type { SystemSettings } from '@/types'
import type { SetSystemSettings } from './settingsTypes'

interface UserNetworkSettingsTabProps {
  settings: SystemSettings | null
  setSettings: SetSystemSettings
  proxySaving: boolean
  onProxySave: () => void
}

export function UserNetworkSettingsTab(props: UserNetworkSettingsTabProps) {
  const { settings, setSettings } = props
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="vben-card">
        <div className="vben-card-header"><h2 className="vben-card-title"><Globe className="h-4 w-4" />代理设置</h2></div>
        <div className="vben-card-body space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">配置网络请求的代理 API，启用后系统会通过该代理转发请求</p>
          <div className="flex items-center justify-between border-b border-slate-100 py-3 dark:border-slate-700">
            <div><p className="font-medium text-slate-900 dark:text-slate-100">启用代理</p><p className="text-sm text-slate-500 dark:text-slate-400">开启后系统将通过下方配置的代理 API 转发网络请求</p></div>
            <label className="switch-ios"><input type="checkbox" checked={Boolean(settings?.['proxy.enabled'] ?? false)} onChange={(event) => setSettings((current) => current ? { ...current, 'proxy.enabled': event.target.checked } : null)} /><span className="switch-slider" /></label>
          </div>
          <div className="input-group">
            <label className="input-label">代理 API 的 URL</label>
            <textarea value={String(settings?.['proxy.api_url'] || '')} onChange={(event) => setSettings((current) => current ? { ...current, 'proxy.api_url': event.target.value } : null)} placeholder="请输入代理 API 的 URL，例如：https://example.com/proxy?token=xxx&region=cn" className="input-ios min-h-[72px] resize-y break-all" />
            <p className="mt-1 text-xs text-slate-400">代理 API 的完整地址，支持长链接</p>
          </div>
          <SaveButton saving={props.proxySaving} onClick={props.onProxySave} label="保存代理设置" />
        </div>
      </div>
    </div>
  )
}

function SaveButton({ saving, onClick, label }: { saving: boolean; onClick: () => void; label: string }) {
  return <div className="flex justify-end pt-2"><button type="button" onClick={onClick} disabled={saving} className="btn-ios-primary">{saving ? <ButtonLoading /> : <Save className="h-4 w-4" />}{label}</button></div>
}
