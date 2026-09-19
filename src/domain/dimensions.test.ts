import { describe, expect, it } from 'vitest'
import { assertDimensions, autoDimensions, dimensionError } from './dimensions'

describe('grid dimensions', () => {
  it.each(['4', '16', '20', '24', '25', '64'])('accepts %s', value => {
    expect(dimensionError(value)).toBeNull()
  })
  it.each(['', '0', '3', '65', '4.5', 'abc', 'NaN', 'Infinity', '-4', '4e0'])('rejects %s', value => {
    expect(dimensionError(value)).toBeTruthy()
  })
  it('guards domain entry points', () => {
    expect(() => assertDimensions(4, 24)).not.toThrow()
    expect(() => assertDimensions(24, 64)).not.toThrow()
    expect(() => assertDimensions(64, 64)).not.toThrow()
    expect(() => assertDimensions(65, 4)).toThrow()
    expect(() => assertDimensions(24, 65)).toThrow()
    expect(() => assertDimensions(24, 4.5)).toThrow()
  })
  it('keeps row and column limits aligned', () => {
    expect(dimensionError('64', 'columns')).toBeNull()
    expect(dimensionError('64')).toBeNull()
    expect(dimensionError('65')).toBeTruthy()
    expect(dimensionError('65', 'columns')).toBeTruthy()
    expect(dimensionError('24.5', 'columns')).toBeTruthy()
  })
  it.each([
    [200, 100, 13, 25],
    [100, 200, 28, 14],
    [100, 100, 25, 25],
    [10000, 1, 4, 25],
    [1, 10000, 28, 4],
    [400, 300, 19, 25],
    [250, 280, 28, 25],
  ])('auto fits %s x %s', (width, height, rows, columns) => {
    expect(autoDimensions(width, height)).toEqual({ rows, columns })
  })
  it('rejects invalid auto image dimensions', () => {
    expect(() => autoDimensions(0, 1)).toThrow()
    expect(() => autoDimensions(Infinity, 1)).toThrow()
  })
})
