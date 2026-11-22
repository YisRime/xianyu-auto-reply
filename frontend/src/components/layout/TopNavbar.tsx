import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { initializeThemeMode, toggleThemeMode } from '@/utils/theme'

interface TopNavbarProps {
  systemName?: string
}

export function TopNavbar({ systemName = '闲鱼管理系统' }: TopNavbarProps) {
  const [isDark, setIsDark] = useState(false)

  // 初始化主题
  useEffect(() => {
    setIsDark(initializeThemeMode() === 'dark')
  }, [])

  const toggleTheme = () => {
    setIsDark(toggleThemeMode() === 'dark')
  }

  return (
    <div className="top-navbar">
      {/* 左侧 - 标题 */}
      <div className="flex items-center gap-3 ml-12 sm:ml-0 flex-1 min-w-0">
        <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline max-w-[320px] truncate">
          {`欢迎使用${systemName}`}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400 sm:hidden max-w-[140px] truncate">
          {systemName}
        </span>
      </div>

      {/* 右侧 - 工具栏 */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* 主题切换 */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-slate-500 dark:text-slate-400 
                     hover:bg-slate-100 dark:hover:bg-slate-700 
                     hover:text-slate-700 dark:hover:text-slate-200
                     transition-colors duration-150"
          title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </div>
  )
}
