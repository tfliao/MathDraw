import { describe, expect, it } from 'vitest'
import { fitImage, sampleCells } from './sampling'

describe('image sampling', () => {
  it.each([
    [200, 100, { x: 0, y: 25, width: 100, height: 50 }],
    [100, 200, { x: 25, y: 0, width: 50, height: 100 }],
    [100, 100, { x: 0, y: 0, width: 100, height: 100 }],
  ])('fits %s by %s without cropping', (width, height, expected) => {
    expect(fitImage(width, height, 100, 100)).toEqual(expected)
  })
  it('averages cells in linear light rather than gamma-encoded RGB', () => {
    const data = new Uint8ClampedArray(8 * 8 * 4)
    for (let pixel = 0; pixel < 64; pixel++) {
      const value = pixel % 2 ? 255 : 0
      data.set([value, value, value, 255], pixel * 4)
    }
    const colors = sampleCells(data, 4, 4, 2)
    expect(colors).toHaveLength(16)
    expect(colors.every(rgb => rgb.every(channel => channel === 188))).toBe(true)
  })
  it('guards dimensions and buffer sizes', () => {
    expect(() => fitImage(0, 100, 100, 100)).toThrow()
    expect(() => sampleCells(new Uint8ClampedArray(0), 4, 4)).toThrow()
  })
})
