import type React from 'react'
import {
  Ban,
  BarChart3,
  Bell,
  BellOff,
  Database,
  FileText,
  Filter,
  Flower2,
  Image,
  Key,
  Layers,
  LayoutDashboard,
  LineChart,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Package,
  PackageSearch,
  Repeat,
  ScrollText,
  Send,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Store,
  Tags,
  Ticket,
  Timer,
  Users,
} from 'lucide-react'

export interface NavItem {
  key: string
  icon: React.ElementType
  label: string
  path: string
  adminOnly?: boolean
}

export interface NavGroup {
  key: string
  icon: React.ElementType
  label: string
  adminOnly?: boolean
  children: NavItem[]
}

export type NavEntry = NavItem | NavGroup

/** EXE 模式下强制隐藏的一级菜单 */
export const EXE_FORCED_HIDDEN_MENU_KEYS = ['product-publish'] as const

const EXE_BLOCKED_PATH_PREFIXES = ['/accounts/shared-scan', '/shared-scan']

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry
}

export const mainNavItems: NavEntry[] = [
  { key: 'dashboard', icon: LayoutDashboard, label: '仪表盘', path: '/dashboard' },
  {
    key: 'data-analysis',
    icon: BarChart3,
    label: '数据分析',
    children: [
      { key: 'data-overview', icon: LineChart, label: '数据总览', path: '/data-analysis/overview' },
    ],
  },
  { key: 'accounts', icon: Users, label: '账号管理', path: '/accounts' },
  { key: 'online-chat-new', icon: MessageSquare, label: '在线聊天', path: '/online-chat-new' },
  { key: 'items', icon: Package, label: '商品管理', path: '/items' },
  { key: 'cards', icon: Ticket, label: '卡券管理', path: '/cards' },
  { key: 'orders', icon: ShoppingCart, label: '订单管理', path: '/orders' },
  {
    key: 'product-publish',
    icon: Store,
    label: '商品发布',
    children: [
      { key: 'product-publish-materials', icon: Image, label: '素材库', path: '/product-publish/materials' },
      { key: 'product-publish-single', icon: Send, label: '单品发布', path: '/product-publish/single' },
      { key: 'product-publish-batch', icon: Layers, label: '批量发布', path: '/product-publish/batch' },
      { key: 'product-publish-scheduled', icon: Timer, label: '定时发布', path: '/product-publish/scheduled' },
      { key: 'product-publish-addresses', icon: MapPin, label: '地址库', path: '/product-publish/addresses' },
      { key: 'product-publish-logs', icon: ScrollText, label: '发布日志', path: '/product-publish/logs' },
    ],
  },
  {
    key: 'product-monitor',
    icon: PackageSearch,
    label: '商品监控',
    children: [
      { key: 'product-monitor-overview', icon: LayoutDashboard, label: '监控总览', path: '/product-monitor/overview' },
      { key: 'product-monitor-categories', icon: Tags, label: '监控分类', path: '/product-monitor/categories' },
      { key: 'product-monitor-listing', icon: PackageSearch, label: '商品监控', path: '/product-monitor/listing' },
      { key: 'product-monitor-logs', icon: ScrollText, label: '监控日志', path: '/product-monitor/logs' },
      { key: 'product-monitor-items', icon: Package, label: '采集商品', path: '/product-monitor/items' },
      { key: 'product-monitor-order-fallback', icon: ShoppingCart, label: '下单账号', path: '/product-monitor/order-fallback-accounts' },
      { key: 'product-monitor-collect-fallback', icon: Users, label: '采集账号', path: '/product-monitor/collect-fallback-accounts' },
    ],
  },
  { key: 'keywords', icon: MessageSquare, label: '自动回复', path: '/keywords' },
  { key: 'message-logs', icon: ScrollText, label: '消息日志', path: '/message-logs' },
  { key: 'risk-logs', icon: Shield, label: '风控日志', path: '/risk-logs' },
  { key: 'message-filters', icon: Filter, label: '消息过滤', path: '/message-filters' },
  { key: 'notification-channels', icon: Bell, label: '通知渠道', path: '/notification-channels' },
  { key: 'message-notifications', icon: MessageCircle, label: '消息通知', path: '/message-notifications' },
  { key: 'blacklist', icon: Ban, label: '黑名单管理', path: '/blacklist' },
]

export const adminNavItems: NavEntry[] = [
  { key: 'settings', icon: Settings, label: '系统设置', path: '/settings', adminOnly: true },
  {
    key: 'admin-logs',
    icon: ScrollText,
    label: '日志管理',
    adminOnly: true,
    children: [
      { key: 'admin-system-logs', icon: FileText, label: '系统日志', path: '/admin/logs', adminOnly: true },
      { key: 'admin-redelivery-batches', icon: Repeat, label: '补发货日志', path: '/admin/redelivery-batches', adminOnly: true },
      { key: 'admin-account-login-logs', icon: LogIn, label: '账号登录日志', path: '/admin/account-login-logs', adminOnly: true },
      { key: 'admin-rate-batches', icon: Star, label: '补评价日志', path: '/admin/rate-batches', adminOnly: true },
      { key: 'admin-polish-batches', icon: Star, label: '擦亮日志', path: '/admin/polish-batches', adminOnly: true },
      { key: 'admin-login-renew-batches', icon: Key, label: '登录续期日志', path: '/admin/login-renew-batches', adminOnly: true },
      { key: 'admin-token-renewal-batches', icon: Key, label: 'Token续期日志', path: '/admin/token-renewal-batches', adminOnly: true },
      { key: 'admin-cookies-refresh-batches', icon: Key, label: 'COOKIES刷新日志', path: '/admin/cookies-refresh-batches', adminOnly: true },
      { key: 'admin-api-cookie-renew-batches', icon: Key, label: '接口续期Cookies日志', path: '/admin/api-cookie-renew-batches', adminOnly: true },
      { key: 'admin-close-notice-batches', icon: BellOff, label: '消息通知关闭日志', path: '/admin/close-notice-batches', adminOnly: true },
      { key: 'admin-red-flower-batches', icon: Flower2, label: '求小红花日志', path: '/admin/red-flower-batches', adminOnly: true },
      { key: 'admin-db-backup-logs', icon: Database, label: '数据库备份日志', path: '/admin/db-backup-logs', adminOnly: true },
      { key: 'admin-email-logs', icon: Mail, label: '邮件日志', path: '/admin/email-logs', adminOnly: true },
    ],
  },
  { key: 'admin-scheduled-tasks', icon: Timer, label: '定时任务', path: '/admin/scheduled-tasks', adminOnly: true },
]

function matchesPath(currentPath: string, targetPath: string): boolean {
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}

export function getExeForcedHiddenMenuKeys(isExeMode: boolean): string[] {
  return isExeMode ? Array.from(EXE_FORCED_HIDDEN_MENU_KEYS) : []
}

function isExeBlockedPath(path: string, isExeMode: boolean): boolean {
  if (!isExeMode) {
    return false
  }
  return EXE_BLOCKED_PATH_PREFIXES.some((targetPath) => matchesPath(path, targetPath))
}

const routeParentKeyMap: Record<string, string> = {
  '/accounts/shared-scan': 'accounts',
  '/shared-scan': 'accounts',
}

function getRouteParentEntry(path: string): NavEntry | NavItem | null {
  const parentKey = Object.entries(routeParentKeyMap).find(([routePath]) => matchesPath(path, routePath))?.[1]
  if (!parentKey) {
    return null
  }

  const allEntries: Array<NavEntry | NavItem> = [...mainNavItems, ...adminNavItems]
  return allEntries.find((entry) => entry.key === parentKey) || null
}

export function getTopLevelMenuEntryByPath(path: string): NavEntry | NavItem | null {
  const routeParentEntry = getRouteParentEntry(path)
  if (routeParentEntry) {
    return routeParentEntry
  }

  const allEntries: NavEntry[] = [...mainNavItems, ...adminNavItems]
  for (const entry of allEntries) {
    if (isNavGroup(entry)) {
      if (entry.children.some((child) => matchesPath(path, child.path))) {
        return entry
      }
      continue
    }
    if (matchesPath(path, entry.path)) {
      return entry
    }
  }

  return null
}

export function findTopLevelMenuKeyByPath(path: string): string | null {
  return getTopLevelMenuEntryByPath(path)?.key || null
}

/** 判断路径是否在当前运行模式下被禁止访问（EXE 模式下商品发布与共享扫码不可用）。 */
export function isPathBlockedForUser(path: string, isExeMode: boolean = false): boolean {
  if (isExeBlockedPath(path, isExeMode)) {
    return true
  }

  const topLevelEntry = getTopLevelMenuEntryByPath(path)
  if (!topLevelEntry) {
    return false
  }

  return getExeForcedHiddenMenuKeys(isExeMode).includes(topLevelEntry.key)
}

export function getMenuAccessFallbackPath(isExeMode: boolean = false): string {
  const forcedHiddenMenuKeys = getExeForcedHiddenMenuKeys(isExeMode)
  const visibleMain = mainNavItems.find((entry) => !forcedHiddenMenuKeys.includes(entry.key))
  if (visibleMain) {
    if (isNavGroup(visibleMain)) {
      return visibleMain.children[0]?.path || '/dashboard'
    }
    return visibleMain.path
  }
  return '/dashboard'
}
