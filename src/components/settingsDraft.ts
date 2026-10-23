import { DEFAULT_SETTINGS } from '../domain/settings'
import type { Operator, PuzzleSettings, ResizeAlgorithm } from '../domain/settings'
import type { OutputColorSet } from '../domain/crayonSets'

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
  outputColorSet: OutputColorSet
}

export const DEFAULT_DRAFT: SettingsDraft = {
  ...DEFAULT_SETTINGS, maxOperand: '9', maxColors: '8', maxResult: '99', maxResultsPerColor: String(DEFAULT_SETTINGS.maxResultsPerColor),
}

export function parseSettings(draft: SettingsDraft): PuzzleSettings {
  return { ...draft, maxOperand: Number(draft.maxOperand), maxColors: Number(draft.maxColors), maxResult: draft.maxResult.trim() === '' ? NaN : Number(draft.maxResult), maxResultsPerColor: Number(draft.maxResultsPerColor) }
}
