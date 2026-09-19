import { describe, expect, it } from 'vitest'
import { colorDistance, isNearWhite, linearToSrgb, rgbToLab, srgbToLinear, toHex } from './color'
import type { Rgb } from './color'

describe('color math', () => {
  it.each([
    [[0, 0, 0], [0, 0, 0]],
    [[255, 255, 255], [100, 0, 0]],
    [[255, 0, 0], [53.24, 80.09, 67.20]],
    [[0, 255, 0], [87.73, -86.18, 83.18]],
    [[0, 0, 255], [32.30, 79.19, -107.86]],
  ] satisfies [Rgb, Rgb][])('converts reference RGB %j to Lab', (rgb, reference) => {
    rgbToLab(rgb).forEach((channel, index) => expect(channel).toBeCloseTo(reference[index], 1))
  })
  it('round trips all 8-bit channels through linear light', () => {
    for (let channel = 0; channel <= 255; channel++) expect(linearToSrgb(srgbToLinear(channel))).toBe(channel)
  })
  it('formats hex and computes CIE76 distance', () => {
    expect(toHex([0, 15, 255])).toBe('#000fff')
    expect(colorDistance([0, 0, 0], [3, 4, 0])).toBe(5)
  })
  it.each([
    [[255, 255, 255], true],
    [[240, 240, 240], true],
    [[255, 240, 250], true],
    [[239, 255, 255], false],
    [[255, 239, 255], false],
    [[255, 255, 239], false],
    [[0, 0, 0], false],
  ] satisfies [Rgb, boolean][])('classifies near-white RGB %j as %s', (rgb, expected) => {
    expect(isNearWhite(rgb)).toBe(expected)
  })
})
