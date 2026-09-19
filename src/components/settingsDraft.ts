import { DEFAULT_SETTINGS } from '../domain/settings'
import type { Operator, PuzzleSettings } from '../domain/settings'

export interface SettingsDraft {
  allowZero: boolean
  maxOperand: string
  operators: readonly Operator[]
  multiMap: boolean
  maxColors: string
  maxResult: string
  allowZeroResults: boolean
}

export const DEFAULT_DRAFT: SettingsDraft = {
  ...DEFAULT_SETTINGS, maxOperand: '9', maxColors: '8', maxResult: '99',
}

export function parseSettings(draft: SettingsDraft): PuzzleSettings {
  return { ...draft, maxOperand: Number(draft.maxOperand), maxColors: Number(draft.maxColors), maxResult: draft.maxResult.trim() === '' ? NaN : Number(draft.maxResult) }
}
