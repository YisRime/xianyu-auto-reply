import type { Dispatch, SetStateAction } from 'react'
import type { SystemSettings } from '@/types'

export type SettingsTab = 'basic' | 'contact' | 'appearance' | 'user' | 'runtime'
export type SetSystemSettings = Dispatch<SetStateAction<SystemSettings | null>>

