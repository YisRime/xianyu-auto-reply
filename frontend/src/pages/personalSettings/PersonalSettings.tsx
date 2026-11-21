/** 个人设置页面：基础设置与远程 URL 配置。 */
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageLoading } from '@/components/common/Loading'
import { PersonalBasicSettings } from './PersonalBasicSettings'
import { LocationRemoteSettingsCard } from './LocationRemoteSettingsCard'
import { TokenRemoteSettingsCard } from './TokenRemoteSettingsCard'
import { usePersonalSettingsData } from './usePersonalSettingsData'

export function PersonalSettings() {
  const settings = usePersonalSettingsData()
  const [activeTab, setActiveTab] = useState<'basic' | 'remote'>('basic')
  const [remoteOpened, setRemoteOpened] = useState(false)
  const { loading, loadSettings } = settings

  if (loading) {
    return <PageLoading />
  }

  return (
    <div className="space-y-4">
      {/* 页头 */}
      <div className="page-header flex-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">个人设置</h1>
          <p className="page-description">管理个人账户信息和偏好设置</p>
        </div>
        <button onClick={loadSettings} className="btn-ios-secondary">
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 账户信息 */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button type="button" onClick={() => setActiveTab('basic')} className={`border-b-2 px-4 py-2 text-sm font-medium transition ${activeTab === 'basic' ? 'border-[rgb(var(--color-primary))] text-[rgb(var(--color-primary))]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
          基础设置
        </button>
        <button type="button" onClick={() => { setActiveTab('remote'); setRemoteOpened(true) }} className={`border-b-2 px-4 py-2 text-sm font-medium transition ${activeTab === 'remote' ? 'border-[rgb(var(--color-primary))] text-[rgb(var(--color-primary))]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
          远程URL配置
        </button>
      </div>

      <div className={activeTab === 'basic' ? 'space-y-4' : 'hidden'}>
        <PersonalBasicSettings settings={settings} />
      </div>
      {remoteOpened && (
        <div className={activeTab === 'remote' ? 'space-y-4' : 'hidden'}>
          <LocationRemoteSettingsCard />
          <TokenRemoteSettingsCard />
        </div>
      )}
    </div>
  )
}
