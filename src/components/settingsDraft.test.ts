import { expect, it } from 'vitest'
import { DEFAULT_DRAFT, parseSettings } from './settingsDraft'
import { settingsErrors } from '../domain/settings'

it('distinguishes an empty maximum result from an explicit zero', () => {
  expect(settingsErrors(parseSettings({ ...DEFAULT_DRAFT, maxResult: '' })).maxResult).toBeTruthy()
  expect(settingsErrors(parseSettings({ ...DEFAULT_DRAFT, maxResult: '0' })).maxResult).toBeNull()
  expect(parseSettings(DEFAULT_DRAFT)).toMatchObject({ maxResult: 99, allowZeroResults: false })
})
