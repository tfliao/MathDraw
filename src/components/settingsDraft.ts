import { DEFAULT_SETTINGS } from '../domain/settings'
import type { Operator, PuzzleSettings, ResizeAlgorithm } from '../domain/settings'

export interface SettingsDraft {
  allowZero: boolean
  maxOperand: string
  operators: readonly Operator[]
  multiMap: boolean
  maxResultsPerColor: string
  skipBackground: boolean
  maxColors: string
  maxResult: string
  allowZeroResults: boolean
  resizeAlgorithm: ResizeAlgorithm
  mergeSimilarColors: boolean
}

export const DEFAULT_DRAFT: SettingsDraft = {
  ...DEFAULT_SETTINGS, maxOperand: '9', maxColors: '8', maxResult: '99', maxResultsPerColor: String(DEFAULT_SETTINGS.maxResultsPerColor),
}

export function parseSettings(draft: SettingsDraft): PuzzleSettings {
  return { ...draft, maxOperand: Number(draft.maxOperand), maxColors: Number(draft.maxColors), maxResult: draft.maxResult.trim() === '' ? NaN : Number(draft.maxResult), maxResultsPerColor: Number(draft.maxResultsPerColor) }
}
