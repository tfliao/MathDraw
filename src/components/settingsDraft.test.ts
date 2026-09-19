import { expect, it } from 'vitest'
import { DEFAULT_DRAFT, parseSettings } from './settingsDraft'
import { settingsErrors } from '../domain/settings'

it('distinguishes an empty maximum result from an explicit zero', () => {
  expect(settingsErrors(parseSettings({ ...DEFAULT_DRAFT, maxResult: '' })).maxResult).toBeTruthy()
  expect(settingsErrors(parseSettings({ ...DEFAULT_DRAFT, maxResult: '0' })).maxResult).toBeNull()
  expect(parseSettings(DEFAULT_DRAFT)).toMatchObject({ maxResult: 99, allowZeroResults: false })
})

it('parses the per-color result cap and preserves the background toggle', () => {
  expect(parseSettings(DEFAULT_DRAFT)).toMatchObject({ maxResultsPerColor: 3, skipBackground: false })
  expect(parseSettings({ ...DEFAULT_DRAFT, maxResultsPerColor: '8', skipBackground: true })).toMatchObject({ maxResultsPerColor: 8, skipBackground: true })
  for (const maxResultsPerColor of ['', '0', '9', '1.5']) {
    expect(settingsErrors(parseSettings({ ...DEFAULT_DRAFT, maxResultsPerColor })).maxResultsPerColor).toBeTruthy()
  }
})
