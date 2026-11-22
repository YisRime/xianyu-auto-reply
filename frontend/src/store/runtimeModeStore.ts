import { create } from 'zustand'

interface RuntimeModeState {
  /** 是否为打包后的 EXE 运行模式 */
  isExeMode: boolean
  setIsExeMode: (value: boolean) => void
}

export const useRuntimeModeStore = create<RuntimeModeState>((set) => ({
  isExeMode: false,
  setIsExeMode: (value) => set({ isExeMode: Boolean(value) }),
}))
