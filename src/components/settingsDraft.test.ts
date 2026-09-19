import { expect, it } from 'vitest'
import { DEFAULT_DRAFT, parseSettings } from './settingsDraft'
import { DEFAULT_SETTINGS, RESIZE_ALGORITHMS, settingsErrors } from '../domain/settings'
import type { ResizeAlgorithm } from '../domain/settings'

it('distinguishes an empty maximum result from an explicit zero', () => {
  expect(settingsErrors(parseSettings({ ...DEFAULT_DRAFT, maxResult: '' })).maxResult).toBeTruthy()
  expect(settingsErrors(parseSettings({ ...DEFAULT_DRAFT, maxResult: '0' })).maxResult).toBeNull()
  expect(parseSettings(DEFAULT_DRAFT)).toMatchObject({ maxResult: 99, allowZeroResults: false })
})

it('parses all defaults consistently, including image settings', () => {
  expect(DEFAULT_DRAFT.resizeAlgorithm).toBe('pica')
  expect(DEFAULT_DRAFT.mergeSimilarColors).toBe(false)
  expect(parseSettings(DEFAULT_DRAFT)).toEqual(DEFAULT_SETTINGS)
})

it.each(RESIZE_ALGORITHMS)('preserves %s and both merging choices while parsing numeric fields', resizeAlgorithm => {
  for (const mergeSimilarColors of [false, true]) {
    const draft = { ...DEFAULT_DRAFT, resizeAlgorithm, mergeSimilarColors, maxColors: '12', maxOperand: '20', skipBackground: true }
    const original = { ...draft }
    expect(parseSettings(draft)).toMatchObject({ resizeAlgorithm, mergeSimilarColors, maxColors: 12, maxOperand: 20, skipBackground: true })
    expect(draft).toEqual(original)
  }
})

it('preserves invalid algorithm values for validation instead of silently substituting a default', () => {
  const parsed = parseSettings({ ...DEFAULT_DRAFT, resizeAlgorithm: 'unknown' as ResizeAlgorithm })
  expect(parsed.resizeAlgorithm).toBe('unknown')
  expect(settingsErrors(parsed).resizeAlgorithm).toBeTruthy()
})

it('parses the per-color result cap and preserves the background toggle', () => {
  expect(parseSettings(DEFAULT_DRAFT)).toMatchObject({ maxResultsPerColor: 3, skipBackground: false })
  expect(parseSettings({ ...DEFAULT_DRAFT, maxResultsPerColor: '8', skipBackground: true })).toMatchObject({ maxResultsPerColor: 8, skipBackground: true })
  for (const maxResultsPerColor of ['', '0', '9', '1.5']) {
    expect(settingsErrors(parseSettings({ ...DEFAULT_DRAFT, maxResultsPerColor })).maxResultsPerColor).toBeTruthy()
  }
})
