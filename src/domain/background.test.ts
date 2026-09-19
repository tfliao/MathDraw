import { describe, expect, it } from 'vitest'
import { backgroundMask } from './background'
import type { Rgb } from './color'

function maskFor(rows: readonly string[], palette: readonly Rgb[] = [[0, 0, 0], [255, 255, 255]]) {
  return backgroundMask({
    rows: rows.length, columns: rows[0].length, palette,
    assignments: rows.flatMap(row => [...row].map(Number)),
  })
}

describe('final-grid background detection', () => {
  it.each([
    ['00100', '00100', '00100', '00000', '00000'],
    ['00000', '00000', '00100', '00100', '00100'],
    ['00000', '00000', '11100', '00000', '00000'],
    ['00000', '00000', '00111', '00000', '00000'],
  ])('floods side-connected white from every edge: %j', (...rows) => {
    expect(maskFor(rows)).toEqual(rows.flatMap(row => [...row].map(value => value === '1')))
  })
  it.each([
    [255, 255, 255], [240, 240, 240], [240, 250, 255],
  ] satisfies Rgb[])('includes near-white RGB %j', (r, g, b) => {
    expect(maskFor(['1111', '1111', '1111', '1111'], [[0, 0, 0], [r, g, b]])).toEqual(Array(16).fill(true))
  })
  it.each([
    [239, 255, 255], [255, 239, 255], [255, 255, 239],
  ] satisfies Rgb[])('excludes RGB %j when any channel is below 240', (r, g, b) => {
    expect(maskFor(['1111', '1111', '1111', '1111'], [[0, 0, 0], [r, g, b]])).toEqual(Array(16).fill(false))
  })
  it('keeps enclosed white foreground', () => {
    expect(maskFor(['00000', '01110', '01110', '01110', '00000'])).toEqual(Array(25).fill(false))
  })
  it('does not connect diagonal white cells', () => {
    const expected = Array<boolean>(25).fill(false)
    expected[0] = true
    expect(maskFor(['10000', '01000', '00100', '00000', '00000'])).toEqual(expected)
  })
  it('handles separate row edges without treating linear row wrapping as interior connectivity', () => {
    const expected = Array<boolean>(25).fill(false)
    for (const index of [4, 5, 6]) expected[index] = true
    expect(maskFor(['00001', '11000', '00010', '00000', '00000'])).toEqual(expected)
  })
  it('connects neighboring near-white cells across different palette entries', () => {
    const rows = ['0100', '0200', '0300', '0000']
    const expected = Array<boolean>(16).fill(false)
    for (const index of [1, 5, 9]) expected[index] = true
    expect(maskFor(rows, [[0, 0, 0], [255, 255, 255], [240, 240, 240], [250, 245, 240]])).toEqual(expected)
  })
})
