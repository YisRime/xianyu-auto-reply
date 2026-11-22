import { create } from 'zustand'
import type { User } from '@/types'

/**
 * 单用户本地部署：不再有登录流程与令牌校验。
 * 固定使用内置管理员身份，保留同名接口以兼容现有页面读取。
 */
const BUILTIN_ADMIN: User = {
  user_id: 1,
  username: 'admin',
  is_admin: true,
  role: 'ADMIN',
  status: 'ACTIVE',
  account_limit: null,
}

interface AuthState {
  token: string
  refreshToken: string
  user: User
  isAuthenticated: boolean
  _hasHydrated: boolean
  setAuth: (token: string, refreshToken: string, user: User) => void
  clearAuth: () => void
  updateUser: (user: Partial<User>) => void
  setHasHydrated: (state: boolean) => void
  updateTokens: (token: string, refreshToken: string) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  token: 'local',
  refreshToken: '',
  user: BUILTIN_ADMIN,
  isAuthenticated: true,
  _hasHydrated: true,

  setAuth: (token, refreshToken, user) => set({ token, refreshToken, user, isAuthenticated: true }),
  clearAuth: () => set({ token: 'local', refreshToken: '', user: BUILTIN_ADMIN, isAuthenticated: true }),
  updateUser: (userData) => set((state) => ({ user: { ...state.user, ...userData } })),
  setHasHydrated: (state) => set({ _hasHydrated: state }),
  updateTokens: (token, refreshToken) => set({ token, refreshToken }),
}))
