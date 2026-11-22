/**
 * 系统设置中的「重发货触发关键字」卡片。
 *
 * 该配置原属个人设置，用户系统移除后改为全局系统设置：
 * 在闲鱼聊天中自己发送「关键字+订单号」即可触发自动重新发货。
 */
import { useEffect, useState } from 'react'
import { Package, Save } from 'lucide-react'

import { updateSystemSettings } from '@/api/settings'
import { ButtonLoading } from '@/components/common/Loading'
import { useUIStore } from '@/store/uiStore'
import { getApiErrorMessage } from '@/utils/apiError'

interface RedeliveryKeywordSettingProps {
  value: unknown
  onSaved: (keyword: string) => void
}

export function RedeliveryKeywordSetting({ value, onSaved }: RedeliveryKeywordSettingProps) {
  const { addToast } = useUIStore()
  const currentKeyword = String(value ?? '')
  const [keyword, setKeyword] = useState(currentKeyword)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setKeyword(currentKeyword)
  }, [currentKeyword])

  const handleSave = async () => {
    if (saving) return
    const trimmed = keyword.trim()
    try {
      setSaving(true)
      const result = await updateSystemSettings({ redelivery_trigger_keyword: trimmed })
      if (!result.success) {
        addToast({ type: 'error', message: result.message || '重发货触发关键字保存失败' })
        return
      }
      setKeyword(trimmed)
      onSaved(trimmed)
      addToast({ type: 'success', message: '重发货触发关键字保存成功' })
    } catch (error) {
      addToast({ type: 'error', message: getApiErrorMessage(error, '重发货触发关键字保存失败') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="vben-card">
      <div className="vben-card-header">
        <h2 className="vben-card-title">
          <Package className="h-4 w-4" />
          重发货触发关键字
        </h2>
      </div>
      <div className="vben-card-body space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          设置后，在闲鱼聊天中自己发送「关键字+订单号」即可触发自动重新发货。例如关键字为「重新触发」，发送「4502144774044041438重新触发」将提取订单号并自动发货。
          <br />
          <span className="text-amber-500 dark:text-amber-400">
            注意：关键字不包含前后空格；如果订单不在数据库中，系统会自动根据订单号获取订单信息后再发货。留空则关闭此功能。
          </span>
        </p>
        <div className="input-group">
          <label className="input-label">触发关键字</label>
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="例如：重新触发"
            className="input-ios"
          />
          <p className="mt-1 text-xs text-slate-400">保存时会自动去除前后空格；对所有账号生效</p>
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-700">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-ios-primary"
          >
            {saving ? <ButtonLoading /> : <Save className="h-4 w-4" />}
            保存关键字
          </button>
        </div>
      </div>
    </div>
  )
}
