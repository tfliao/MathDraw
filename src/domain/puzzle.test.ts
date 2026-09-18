import { describe, expect, it } from 'vitest'
import type { Rgb } from './color'
import { createPuzzle, OPERANDS } from './puzzle'
import type { ColorGrid } from './palette'

const colors: Rgb[] = [[255, 255, 255], [0, 0, 0], [230, 20, 30], [10, 200, 30], [0, 20, 240], [245, 220, 10], [180, 30, 180], [0, 200, 200]]
const grid: ColorGrid = { rows: 4, columns: 4, palette: colors, assignments: Array.from({ length: 16 }, (_, n) => n % 8) }

describe('addition puzzles', () => {
  it.each(Array.from({ length: 17 }, (_, n) => n + 2))('enumerates every pair for sum %s', sum => {
    const pairs = OPERANDS.get(sum)!
    expect(pairs.length).toBeGreaterThan(0)
    expect(new Set(pairs.map(pair => pair.join(','))).size).toBe(pairs.length)
    pairs.forEach(([a, b]) => {
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
    const puzzle = createPuzzle(grid, () => 0.4)
    expect(puzzle.cells).toHaveLength(16)
    expect(new Set(puzzle.key.map(entry => entry.result)).size).toBe(8)
    expect(puzzle.key.map(entry => entry.result)).toEqual(puzzle.key.map(entry => entry.result).sort((a, b) => a - b))
    puzzle.cells.forEach((cell, index) => {
      const entry = puzzle.key.find(entry => entry.result === cell.a + cell.b)!
      expect(entry.colorIndex).toBe(grid.assignments[index])
      expect(entry.color).toEqual(grid.palette[cell.colorIndex])
    })
    expect(puzzle.key.find(entry => entry.hex === '#ffffff')?.label).toBe('Leave white')
  })
  it('deep freezes the snapshot and copies caller-owned arrays', () => {
    const puzzle = createPuzzle(grid, () => 0)
    expect(puzzle.palette).not.toBe(grid.palette)
    expect(puzzle.assignments).not.toBe(grid.assignments)
    expect(puzzle.palette[0]).not.toBe(grid.palette[0])
    expect(Object.isFrozen(puzzle)).toBe(true)
    expect(Object.isFrozen(puzzle.cells[0])).toBe(true)
    expect(Object.isFrozen(puzzle.key[0])).toBe(true)
    expect(Object.isFrozen(puzzle.palette[0])).toBe(true)
  })
  it('supports a full size grid and a one-color image', () => {
    const puzzle = createPuzzle({ rows: 24, columns: 24, palette: [[1, 2, 3]], assignments: Array(576).fill(0) }, () => 0.999)
    expect(puzzle.cells).toHaveLength(576)
    expect(puzzle.key).toHaveLength(1)
  })
  it('rejects malformed grids and invalid randomness', () => {
    expect(() => createPuzzle({ ...grid, assignments: [] })).toThrow('incomplete')
    expect(() => createPuzzle({ ...grid, assignments: Array(16).fill(8) })).toThrow('invalid')
    expect(() => createPuzzle(grid, () => 1)).toThrow('Random source')
    expect(() => createPuzzle({ ...grid, palette: Array(8).fill([0, 0, 0]) })).toThrow('unique')
  })
})
