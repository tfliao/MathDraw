import { describe, expect, it } from 'vitest'
import type { Rgb } from './color'
import { createPuzzle } from './puzzle'
import { answer, buildProblemPool, DEFAULT_SETTINGS, OPERATORS } from './settings'
import type { ColorGrid } from './palette'

const colors: Rgb[] = [[255, 255, 255], [0, 0, 0], [230, 20, 30], [10, 200, 30], [0, 20, 240], [245, 220, 10], [180, 30, 180], [0, 200, 200]]
const grid: ColorGrid = { rows: 4, columns: 4, palette: colors, assignments: Array.from({ length: 16 }, (_, n) => n % 8) }

describe('addition puzzles', () => {
  it.each(Array.from({ length: 17 }, (_, n) => n + 2))('enumerates every pair for sum %s', sum => {
    const pairs = buildProblemPool(DEFAULT_SETTINGS).get(sum)!
    expect(pairs.length).toBeGreaterThan(0)
    expect(new Set(pairs.map(pair => `${pair.a},${pair.b}`)).size).toBe(pairs.length)
    pairs.forEach(({ a, b }) => {
      expect(a).toBeGreaterThanOrEqual(1)
      expect(a).toBeLessThanOrEqual(9)
      expect(b).toBeGreaterThanOrEqual(1)
      expect(b).toBeLessThanOrEqual(9)
      expect(a + b).toBe(sum)
    })
    const expected = Array.from({ length: 9 }, (_, n) => n + 1).filter(a => sum - a >= 1 && sum - a <= 9)
    expect(pairs).toHaveLength(expected.length)
  })
  it('uses one globally unique sum per color and valid problems in all cells', () => {
    const puzzle = createPuzzle(grid, { ...DEFAULT_SETTINGS, multiMap: false }, () => 0.4)
    expect(puzzle.cells).toHaveLength(16)
    expect(new Set(puzzle.key.flatMap(entry => entry.results)).size).toBe(8)
    expect(puzzle.key.map(entry => entry.results[0])).toEqual(puzzle.key.map(entry => entry.results[0]).sort((a, b) => a - b))
    puzzle.cells.forEach((cell, index) => {
      const entry = puzzle.key.find(entry => entry.results.includes(answer(cell)))!
      expect(entry.colorIndex).toBe(grid.assignments[index])
      expect(entry.color).toEqual(grid.palette[cell.colorIndex])
    })
    expect(puzzle.key.find(entry => entry.hex === '#ffffff')?.label).toBe('Leave white')
  })
  it('uses multiple results per color by default when enough cells and answers exist', () => {
    const puzzle = createPuzzle(grid)
    expect(puzzle.settings.multiMap).toBe(true)
    expect(puzzle.key.every(entry => entry.results.length === 2)).toBe(true)
    expect(new Set(puzzle.cells.map(answer))).toEqual(new Set(puzzle.key.flatMap(entry => entry.results)))
  })
  it('deep freezes the snapshot and copies caller-owned arrays', () => {
    const puzzle = createPuzzle(grid, DEFAULT_SETTINGS, () => 0)
    expect(puzzle.palette).not.toBe(grid.palette)
    expect(puzzle.assignments).not.toBe(grid.assignments)
    expect(puzzle.palette[0]).not.toBe(grid.palette[0])
    expect(Object.isFrozen(puzzle)).toBe(true)
    expect(Object.isFrozen(puzzle.cells[0])).toBe(true)
    expect(Object.isFrozen(puzzle.key[0])).toBe(true)
    expect(Object.isFrozen(puzzle.palette[0])).toBe(true)
    expect(Object.isFrozen(puzzle.key[0].results)).toBe(true)
    expect(Object.isFrozen(puzzle.settings.operators)).toBe(true)
  })
  it('supports a full size grid and a one-color image', () => {
    const puzzle = createPuzzle({ rows: 64, columns: 64, palette: [[1, 2, 3]], assignments: Array(4096).fill(0) }, DEFAULT_SETTINGS, () => 0.999)
    expect(puzzle.cells).toHaveLength(4096)
    expect(puzzle.key).toHaveLength(1)
  })
  it('rejects malformed grids and invalid randomness', () => {
    expect(() => createPuzzle({ ...grid, assignments: [] })).toThrow('incomplete')
    expect(() => createPuzzle({ ...grid, assignments: Array(16).fill(8) })).toThrow('invalid')
    expect(() => createPuzzle(grid, DEFAULT_SETTINGS, () => 1)).toThrow('Random source')
    expect(() => createPuzzle({ ...grid, palette: Array(8).fill([0, 0, 0]) })).toThrow('unique')
  })
  it('groups results without ambiguity and uses every mapped answer', () => {
    const puzzle = createPuzzle({ ...grid, rows: 8, assignments: Array.from({ length: 32 }, (_, n) => n % 8) }, { ...DEFAULT_SETTINGS, maxOperand: 99, multiMap: true, operators: ['+', '-', '*'] }, () => .6)
    expect(puzzle.key.every(entry => entry.results.length === 3)).toBe(true)
    expect(new Set(puzzle.key.flatMap(entry => entry.results)).size).toBe(24)
    puzzle.key.forEach(entry => {
      expect(entry.results).toEqual([...entry.results].sort((a, b) => a - b))
      expect(new Set(puzzle.cells.filter(cell => cell.colorIndex === entry.colorIndex).map(answer))).toEqual(new Set(entry.results))
    })
    puzzle.cells.forEach(cell => {
      expect(cell.a).toBeGreaterThanOrEqual(1)
      expect(cell.b).toBeGreaterThanOrEqual(1)
      expect(cell.a).toBeLessThanOrEqual(99)
      expect(cell.b).toBeLessThanOrEqual(99)
      expect(answer(cell)).toBeGreaterThan(0)
      expect(answer(cell)).toBeLessThanOrEqual(puzzle.settings.maxResult)
      expect(puzzle.key.find(entry => entry.results.includes(answer(cell)))?.colorIndex).toBe(cell.colorIndex)
    })
  })
  it('rejects impossible result settings before creating a puzzle', () => {
    expect(() => createPuzzle(grid, { ...DEFAULT_SETTINGS, maxResult: 1 })).toThrow('no allowed answers')
    expect(() => createPuzzle(grid, { ...DEFAULT_SETTINGS, maxResult: 0, allowZeroResults: true })).toThrow('no allowed answers')
  })
  it('supports a zero-only subtraction puzzle without zero operands', () => {
    const puzzle = createPuzzle({ rows: 4, columns: 4, palette: [[0, 0, 0]], assignments: Array(16).fill(0) }, { ...DEFAULT_SETTINGS, operators: ['-'], maxResult: 0, allowZeroResults: true, multiMap: true })
    expect(puzzle.key[0].results).toEqual([0])
    expect(puzzle.cells.every(cell => cell.a === cell.b && cell.a > 0)).toBe(true)
    expect(puzzle.settings.maxResult).toBe(0)
    expect(puzzle.settings.allowZeroResults).toBe(true)
  })
  it('does not allocate extra results to rare colors or run out of answers', () => {
    const small: ColorGrid = { rows: 4, columns: 4, palette: colors.slice(0, 3), assignments: [0, 1, ...Array(14).fill(2)] }
    const settings = { ...DEFAULT_SETTINGS, multiMap: true, maxOperand: 2 }
    const puzzle = createPuzzle(small, settings, () => .5)
    expect(puzzle.key.every(entry => entry.results.length === 1)).toBe(true)
    const varied = createPuzzle(small, { ...settings, maxOperand: 9 }, () => .5)
    expect(varied.key.find(entry => entry.colorIndex === 0)?.results).toHaveLength(1)
    expect(varied.key.find(entry => entry.colorIndex === 1)?.results).toHaveLength(1)
    expect(varied.key.find(entry => entry.colorIndex === 2)?.results).toHaveLength(3)
    expect(() => createPuzzle(grid, settings)).toThrow('enough results')
  })
  it('supports sixteen colors without weakening unique result mapping', () => {
    const palette: Rgb[] = Array.from({ length: 16 }, (_, index) => [index * 16, 80, 90])
    const puzzle = createPuzzle({ rows: 4, columns: 4, palette, assignments: palette.map((_, index) => index) }, { ...DEFAULT_SETTINGS, maxColors: 16 })
    expect(puzzle.key).toHaveLength(16)
    expect(new Set(puzzle.key.flatMap(entry => entry.results)).size).toBe(16)
  })
  it('maintains the mapping for every operator subset at both operand limits', () => {
    let seed = 6193
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    for (let mask = 1; mask <= 7; mask++) {
      for (const maxOperand of [2, 99]) {
        for (const allowZero of [false, true]) {
          for (const multiMap of [false, true]) {
            const settings = { ...DEFAULT_SETTINGS, operators: OPERATORS.filter((_, index) => mask & (1 << index)), maxOperand, allowZero, multiMap }
            const count = Math.min(colors.length, buildProblemPool(settings).size)
            const puzzle = createPuzzle({ ...grid, palette: colors.slice(0, count), assignments: Array.from({ length: 16 }, (_, n) => n % count) }, settings, random)
            const results = puzzle.key.flatMap(entry => entry.results)
            expect(new Set(results).size).toBe(results.length)
            expect(new Set(puzzle.cells.map(answer))).toEqual(new Set(results))
            puzzle.key.forEach(entry => expect(entry.results.length).toBeLessThanOrEqual(multiMap ? 3 : 1))
            puzzle.cells.forEach(cell => {
              expect(settings.operators).toContain(cell.operator)
              expect(cell.a).toBeGreaterThanOrEqual(allowZero ? 0 : 1)
              expect(cell.b).toBeGreaterThanOrEqual(allowZero ? 0 : 1)
              expect(cell.a).toBeLessThanOrEqual(maxOperand)
              expect(cell.b).toBeLessThanOrEqual(maxOperand)
              expect(answer(cell)).toBeGreaterThan(0)
              expect(answer(cell)).toBeLessThanOrEqual(settings.maxResult)
              expect(puzzle.key.find(entry => entry.results.includes(answer(cell)))?.colorIndex).toBe(cell.colorIndex)
            })
          }
        }
      }
    }
  })
})
