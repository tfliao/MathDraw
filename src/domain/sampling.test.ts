import { describe, expect, it } from 'vitest'
import { fitImage, sampleCells } from './sampling'
import type { Rgb } from './color'

function cellSamples(cells: readonly (readonly Rgb[])[], samples: number, rows = 4, columns = 4) {
  const data = new Uint8ClampedArray(rows * columns * samples * samples * 4)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const colors = cells[(row * columns + column) % cells.length]
      for (let y = 0; y < samples; y++) {
        for (let x = 0; x < samples; x++) {
          const offset = ((row * samples + y) * columns * samples + column * samples + x) * 4
          data.set([...colors[(y * samples + x) % colors.length], 255], offset)
        }
      }
    }
  }
  return data
}

describe('image sampling', () => {
  it.each([
    [200, 100, { x: 0, y: 25, width: 100, height: 50 }],
    [100, 200, { x: 25, y: 0, width: 50, height: 100 }],
    [100, 100, { x: 0, y: 0, width: 100, height: 100 }],
  ])('fits %s by %s without cropping', (width, height, expected) => {
    expect(fitImage(width, height, 100, 100)).toEqual(expected)
  })
  it('ignores a white majority and preserves even one foreground sample', () => {
    const white: Rgb = [255, 255, 255]
    const black: Rgb = [0, 0, 0]
    const patch = [...Array<Rgb>(255).fill(white), black]
    const colors = sampleCells(cellSamples([patch], 16), 4, 4)
    expect(colors).toEqual(Array(16).fill(black))
  })
  it('ignores near-white shades too and uses exact white only when no foreground remains', () => {
    const background: Rgb[] = [[240, 240, 240], [255, 240, 250], [255, 255, 255]]
    expect(sampleCells(cellSamples([background], 2), 4, 4, 2)).toEqual(Array(16).fill([255, 255, 255]))
    const foreground: Rgb = [239, 255, 255]
    expect(sampleCells(cellSamples([[...background, foreground]], 2), 4, 4, 2)).toEqual(Array(16).fill(foreground))
  })
  it('selects the dominant group among remaining foreground shades', () => {
    const red: Rgb = [224, 32, 32]
    const patch: Rgb[] = [
      ...Array<Rgb>(180).fill([250, 250, 250]),
      ...Array<Rgb>(24).fill(red),
      ...Array<Rgb>(24).fill([225, 33, 33]),
      ...Array<Rgb>(28).fill([0, 0, 255]),
    ]
    expect(sampleCells(cellSamples([patch], 16), 4, 4)).toEqual(Array(16).fill(red))
  })
  it('combines similar shades even when another exact color is more frequent', () => {
    const reds: Rgb[] = [[224, 32, 32], [225, 33, 33], [226, 34, 34], [227, 35, 35]]
    const blue: Rgb = [0, 0, 255]
    const patch = [...reds.flatMap(rgb => Array<Rgb>(40).fill(rgb)), ...Array<Rgb>(96).fill(blue)]
    expect(sampleCells(cellSamples([patch], 16), 4, 4)).toEqual(Array(16).fill(reds[0]))
  })
  it('uses the most frequent actual sample within the dominant bucket, not its mean or center', () => {
    const red: Rgb = [227, 35, 35]
    const similar: Rgb = [224, 32, 32]
    const patch: Rgb[] = [similar, red, red, [0, 0, 255]]
    expect(sampleCells(cellSamples([patch], 2), 4, 4, 2)).toEqual(Array(16).fill(red))
  })
  it('resolves equal group and representative counts consistently across traversal orders', () => {
    const black: Rgb = [0, 0, 0]
    const blue: Rgb = [0, 0, 255]
    const red: Rgb = [224, 32, 32]
    const similar: Rgb = [225, 33, 33]
    for (const [patch, expected] of [
      [[blue, black, blue, black], black],
      [[similar, red, similar, red], red],
    ] satisfies [Rgb[], Rgb][]) {
      const forward = sampleCells(cellSamples([patch], 2), 4, 4, 2)
      const reverse = sampleCells(cellSamples([[...patch].reverse()], 2), 4, 4, 2)
      expect(forward).toEqual(Array(16).fill(expected))
      expect(reverse).toEqual(forward)
    }
  })
  it('keeps cells independent and in row-major order', () => {
    const colors: Rgb[] = Array.from({ length: 16 }, (_, index) => [index * 16, 80, 90])
    expect(sampleCells(cellSamples(colors.map(color => [color]), 16), 4, 4)).toEqual(colors)
  })
  it.each([1, 2, 16, 32])('preserves uniform colors and pure white at sample resolution %s', samples => {
    for (const rgb of [[255, 255, 255], [0, 0, 0], [17, 93, 201]] satisfies Rgb[]) {
      expect(sampleCells(cellSamples([[rgb]], samples), 4, 4, samples)).toEqual(Array(16).fill(rgb))
    }
  })
  it('documents the fixed-bucket boundary tradeoff', () => {
    const patch: Rgb[] = [[15, 15, 15], [16, 16, 16], [255, 0, 0], [255, 0, 0]]
    expect(sampleCells(cellSamples([patch], 2), 4, 4, 2)).toEqual(Array(16).fill([255, 0, 0]))
  })
  it('supports the maximum grid with varied samples without blending new colors', () => {
    const patch: Rgb[] = Array.from({ length: 256 }, (_, n) => [n, (n * 37) % 256, (n * 71) % 256])
    const colors = sampleCells(cellSamples([patch], 16, 64, 64), 64, 64)
    expect(colors).toHaveLength(4096)
    expect(patch).toContainEqual(colors[0])
    expect(colors.every(rgb => rgb.every((channel, index) => channel === colors[0][index]))).toBe(true)
  })
  it('guards dimensions and buffer sizes', () => {
    expect(() => fitImage(0, 100, 100, 100)).toThrow()
    expect(() => sampleCells(new Uint8ClampedArray(0), 4, 4)).toThrow()
  })
  it.each([0, -1, 1.5, 33, NaN])('rejects invalid sample resolution %s', samples => {
    expect(() => sampleCells(new Uint8ClampedArray(0), 4, 4, samples)).toThrow('sampling resolution')
  })
})
