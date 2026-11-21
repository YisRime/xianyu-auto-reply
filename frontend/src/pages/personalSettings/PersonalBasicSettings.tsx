/** 个人设置基础内容：账户信息、重发货触发关键字与修改密码。 */
import { User, Key, Package, Save } from 'lucide-react'
import { ButtonLoading } from '@/components/common/Loading'
import { PasswordInput } from '@/components/common/PasswordInput'
import type { usePersonalSettingsData } from './usePersonalSettingsData'

interface PersonalBasicSettingsProps {
  settings: ReturnType<typeof usePersonalSettingsData>
}

export function PersonalBasicSettings({ settings }: PersonalBasicSettingsProps) {
  const {
    user,
    redeliveryKeyword,
    setRedeliveryKeyword,
    savingRedeliveryKeyword,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    changingPassword,
    handleSaveRedeliveryKeyword,
    handleChangePassword
  } = settings
  return (
    <>
      <div className="vben-card">
        <div className="vben-card-header">
          <h2 className="vben-card-title">
            <User className="w-4 h-4" />
            账户信息
          </h2>
        </div>
        <div className="vben-card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">用户名</label>
              <input
                type="text"
                value={user?.username || ''}
                disabled
                className="input-ios bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="input-label">角色</label>
              <input
                type="text"
                value={user?.is_admin ? '管理员' : '普通用户'}
                disabled
                className="input-ios bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>
      {/* 重发货触发关键字 */}
      <div className="vben-card">
        <div className="vben-card-header">
          <h2 className="vben-card-title">
            <Package className="w-4 h-4" />
            重发货触发关键字
          </h2>
        </div>
        <div className="vben-card-body space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            设置后，在闲鱼聊天中自己发送「关键字+订单号」即可触发自动重新发货。例如关键字为「重新触发」，发送「4502144774044041438重新触发」将提取订单号并自动发货。
            <br />
            <span className="text-amber-500 dark:text-amber-400">注意：关键字不包含前后空格；如果订单不在数据库中，系统会自动根据订单号获取订单信息后再发货。</span>
          </p>
          <div className="input-group">
            <label className="input-label">触发关键字</label>
            <input
              type="text"
              value={redeliveryKeyword}
              onChange={(e) => setRedeliveryKeyword(e.target.value)}
              placeholder="例如：重新触发"
              className="input-ios"
            />
            <p className="text-xs text-gray-400 mt-1">保存时会自动去除前后空格；留空则关闭此功能</p>
          </div>
          <button
            onClick={handleSaveRedeliveryKeyword}
            disabled={savingRedeliveryKeyword}
            className="btn-ios-primary"
          >
            {savingRedeliveryKeyword ? <ButtonLoading /> : <Save className="w-4 h-4" />}
            保存
          </button>
        </div>
      </div>

      {/* 修改密码 */}
      <div className="vben-card">
        <div className="vben-card-header">
          <h2 className="vben-card-title">
            <Key className="w-4 h-4" />
            修改密码
          </h2>
        </div>
        <div className="vben-card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="input-group">
              <label className="input-label">当前密码</label>
              <PasswordInput value={currentPassword} onChange={setCurrentPassword} placeholder="请输入当前密码" />
            </div>
            <div />
            <div className="input-group">
              <label className="input-label">新密码</label>
              <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="请输入新密码（至少6位）" />
            </div>
            <div className="input-group">
              <label className="input-label">确认新密码</label>
              <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="请再次输入新密码" />
            </div>
          </div>
          <button onClick={handleChangePassword} disabled={changingPassword} className="btn-ios-primary">
            {changingPassword ? <ButtonLoading /> : <Key className="w-4 h-4" />}
            修改密码
          </button>
        </div>
      </div>

    </>
  )
}
