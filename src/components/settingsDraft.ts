import { DEFAULT_SETTINGS } from '../domain/settings'
import type { Operator, PuzzleSettings } from '../domain/settings'

export interface SettingsDraft {
  allowZero: boolean
  maxOperand: string
  operators: readonly Operator[]
  multiMap: boolean
  maxColors: string
}

export const DEFAULT_DRAFT: SettingsDraft = {
  ...DEFAULT_SETTINGS, maxOperand: '9', maxColors: '8',
}

export function parseSettings(draft: SettingsDraft): PuzzleSettings {
  return { ...draft, maxOperand: Number(draft.maxOperand), maxColors: Number(draft.maxColors) }
}
