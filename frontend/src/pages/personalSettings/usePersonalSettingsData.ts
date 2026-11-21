/** 个人设置原有账户、分销及偏好数据，保持既有读取和保存流程。 */
import { useState, useEffect } from 'react'
import { getUserSetting, updateUserSetting, changePassword, getSystemSettings, getCurrentUserProfile } from '@/api/settings'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'

// 余额设置的 key
const BALANCE_KEY = 'balance'
// 续期单价的系统设置 key（普通用户可读，用于计算续期总价）
const RENEW_MONTH_PRICE_KEY = 'user.renew_month_price'

const CONTACT_WECHAT_KEY = 'contact_wechat'
const CONTACT_QQ_KEY = 'contact_qq'
const REDELIVERY_TRIGGER_KEYWORD_KEY = 'redelivery_trigger_keyword'
const PAYMENT_QRCODE_KEY = 'payment_qrcode'
const PAYMENT_TYPE_KEY = 'payment_type'
// 对接卡密秘钥的 key（按用户存储，用于「分销卡券」页面对接上游卡券系统）

export function usePersonalSettingsData() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated, user, clearAuth } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState('')
  const [showRecharge, setShowRecharge] = useState(false)
  const [expireAt, setExpireAt] = useState<string | null>(null)
  const [renewPrice, setRenewPrice] = useState('')
  const [showRenew, setShowRenew] = useState(false)
  const [paymentQrcode, setPaymentQrcode] = useState('')
  const [paymentType, setPaymentType] = useState<'alipay' | 'wechat'>('alipay')


  // 联系方式状态
  const [contactWechat, setContactWechat] = useState('')
  const [contactQQ, setContactQQ] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  // 重发货触发关键字状态
  const [redeliveryKeyword, setRedeliveryKeyword] = useState('')
  const [savingRedeliveryKeyword, setSavingRedeliveryKeyword] = useState(false)

  // 密码修改状态
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  // 加载个人设置
  const loadSettings = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const result = await getUserSetting(BALANCE_KEY)
      if (result.success && result.value !== undefined) {
        setBalance(result.value)
      } else {
        setBalance('0.00')
      }
      const qrcodeResult = await getUserSetting(PAYMENT_QRCODE_KEY)
      if (qrcodeResult.success && qrcodeResult.value) {
        setPaymentQrcode(qrcodeResult.value)
      }
      const typeResult = await getUserSetting(PAYMENT_TYPE_KEY)
      if (typeResult.success && typeResult.value) {
        setPaymentType(typeResult.value as 'alipay' | 'wechat')
      }
      // 加载重发货触发关键字
      const redeliveryResult = await getUserSetting(REDELIVERY_TRIGGER_KEYWORD_KEY)
      if (redeliveryResult.success && redeliveryResult.value !== undefined) {
        setRedeliveryKeyword(redeliveryResult.value)
      }
      // 加载联系方式
      const wechatResult = await getUserSetting(CONTACT_WECHAT_KEY)
      if (wechatResult.success && wechatResult.value !== undefined) {
        setContactWechat(wechatResult.value)
      }
      const qqResult = await getUserSetting(CONTACT_QQ_KEY)
      if (qqResult.success && qqResult.value !== undefined) {
        setContactQQ(qqResult.value)
      }
      // 加载当前用户到期日
      try {
        const profile = await getCurrentUserProfile()
        setExpireAt(profile.expire_at ?? null)
      } catch {
        // 到期日加载失败不阻断其他设置展示
      }
      // 加载续期单价（普通用户可读）
      try {
        const sysResult = await getSystemSettings()
        if (sysResult.success && sysResult.data) {
          setRenewPrice(String(sysResult.data[RENEW_MONTH_PRICE_KEY] ?? ''))
        }
      } catch {
        // 续期单价加载失败不阻断其他设置展示
      }
    } catch {
      setBalance('0.00')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [_hasHydrated, isAuthenticated, token])

  // 保存重发货触发关键字
  const handleSaveRedeliveryKeyword = async () => {
    try {
      setSavingRedeliveryKeyword(true)
      const trimmed = redeliveryKeyword.trim()
      await updateUserSetting(REDELIVERY_TRIGGER_KEYWORD_KEY, trimmed, '重发货触发关键字')
      setRedeliveryKeyword(trimmed)
      addToast({ type: 'success', message: '重发货触发关键字保存成功' })
    } catch {
      addToast({ type: 'error', message: '保存失败' })
    } finally {
      setSavingRedeliveryKeyword(false)
    }
  }

  // 上传收款码
  // 保存联系方式
  const handleSaveContact = async () => {
    try {
      setSavingContact(true)
      await updateUserSetting(CONTACT_WECHAT_KEY, contactWechat, '微信联系方式')
      await updateUserSetting(CONTACT_QQ_KEY, contactQQ, 'QQ联系方式')
      addToast({ type: 'success', message: '联系方式保存成功' })
    } catch {
      addToast({ type: 'error', message: '保存联系方式失败' })
    } finally {
      setSavingContact(false)
    }
  }

  // 修改密码
  const handleChangePassword = async () => {
    if (!currentPassword) {
      addToast({ type: 'warning', message: '请输入当前密码' })
      return
    }
    if (!newPassword) {
      addToast({ type: 'warning', message: '请输入新密码' })
      return
    }
    if (newPassword !== confirmPassword) {
      addToast({ type: 'warning', message: '两次输入的密码不一致' })
      return
    }
    if (newPassword.length < 6) {
      addToast({ type: 'warning', message: '新密码长度不能少于6位' })
      return
    }
    try {
      setChangingPassword(true)
      const result = await changePassword({ current_password: currentPassword, new_password: newPassword })
      if (result.success) {
        addToast({ type: 'success', message: '密码修改成功，即将退出登录' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        // 延迟1秒后退出登录
        setTimeout(() => {
          clearAuth()
          window.location.href = '/login'
        }, 1000)
      } else {
        addToast({ type: 'error', message: result.message || '密码修改失败' })
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string }
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || '密码修改失败'
      addToast({ type: 'error', message: errorMsg })
    } finally {
      setChangingPassword(false)
    }
  }

  return {
    loading,
    loadSettings,
    user,
    balance,
    setBalance,
    expireAt,
    renewPrice,
    showRenew,
    setShowRenew,
    showRecharge,
    setShowRecharge,
    setExpireAt,
    paymentQrcode,
    setPaymentQrcode,
    paymentType,
    setPaymentType,
    contactWechat,
    setContactWechat,
    contactQQ,
    setContactQQ,
    savingContact,
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
    handleSaveContact,
    handleChangePassword
  }
}
