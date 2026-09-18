import { describe, expect, it } from 'vitest'
import { assertDimensions, dimensionError } from './dimensions'

describe('grid dimensions', () => {
  it.each(['4', '16', '20', '24'])('accepts %s', value => {
    expect(dimensionError(value)).toBeNull()
  })
  it.each(['', '0', '3', '25', '4.5', 'abc', 'NaN', 'Infinity', '-4', '4e0'])('rejects %s', value => {
    expect(dimensionError(value)).toBeTruthy()
  })
  it('guards domain entry points', () => {
    expect(() => assertDimensions(4, 24)).not.toThrow()
    expect(() => assertDimensions(24, 4.5)).toThrow()
  })
})
