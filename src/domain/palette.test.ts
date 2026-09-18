import { describe, expect, it } from 'vitest'
import { colorDistance, rgbToLab } from './color'
import type { Rgb } from './color'
import { MIN_COLOR_DISTANCE, reducePalette } from './palette'

function assertPalette(colors: readonly Rgb[]) {
  const result = reducePalette(colors)
  expect(result.palette.length).toBeGreaterThanOrEqual(1)
  expect(result.palette.length).toBeLessThanOrEqual(8)
  expect(result.assignments).toHaveLength(colors.length)
  expect(new Set(result.assignments).size).toBe(result.palette.length)
  result.palette.forEach((color, a) => {
    expect(colors).toContainEqual(color)
    result.palette.slice(a + 1).forEach(other => {
      expect(colorDistance(rgbToLab(color), rgbToLab(other))).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE)
    })
  })
  expect(reducePalette(colors)).toEqual(result)
  return result
}

describe('perceptually separated palette', () => {
  it('keeps a solid image to one color', () => {
    expect(assertPalette(Array.from({ length: 16 }, () => [120, 30, 50] as const)).palette).toEqual([[120, 30, 50]])
  })
  it('merges nearly identical colors', () => {
    expect(assertPalette([[220, 30, 40], [222, 31, 41], [221, 32, 40]]).palette).toHaveLength(1)
  })
  it('separates grayscale and retains white', () => {
    const colors: Rgb[] = Array.from({ length: 256 }, (_, n) => [n, n, n])
    expect(assertPalette(colors).palette).toContainEqual([255, 255, 255])
  })
  it('reduces a full-sized multicolor image and reserves white', () => {
    const colors: Rgb[] = Array.from({ length: 575 }, (_, n) => [n * 37 % 256, n * 71 % 256, n * 13 % 256])
    colors.push([255, 255, 255])
    const result = assertPalette(colors)
    expect(result.palette[result.assignments[575]]).toEqual([255, 255, 255])
  })
  it('pins white when merging near-white shades', () => {
    expect(assertPalette([[255, 255, 255], [250, 250, 250], [248, 248, 247]]).palette).toEqual([[255, 255, 255]])
  })
  it('rejects invalid input', () => {
    expect(() => reducePalette([])).toThrow()
    expect(() => reducePalette([[256, 0, 0]])).toThrow()
  })
  it('maintains separation on seeded varied palettes and arbitrary input order', () => {
    let seed = 123456
    const channel = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed >>> 24
    }
    for (let sample = 0; sample < 30; sample++) {
      const colors: Rgb[] = Array.from({ length: 100 + sample }, () => [channel(), channel(), channel()])
      if (sample % 2 === 0) colors.push([255, 255, 255])
      const result = assertPalette(colors)
      colors.forEach((color, index) => {
        const selected = colorDistance(rgbToLab(color), rgbToLab(result.palette[result.assignments[index]]))
        expect(result.palette.every(candidate => selected <= colorDistance(rgbToLab(color), rgbToLab(candidate)) + 1e-10)).toBe(true)
      })
    }
  })
})
