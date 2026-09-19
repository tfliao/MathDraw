import { describe, expect, it } from 'vitest'
import { answer, assertSettings, buildProblemPool, DEFAULT_SETTINGS, OPERATORS } from './settings'
import type { Operator } from './settings'

describe('difficulty settings', () => {
  it('retains original defaults', () => {
    expect(DEFAULT_SETTINGS).toEqual({ allowZero: false, maxOperand: 9, operators: ['+'], multiMap: false, maxColors: 8 })
    expect([...buildProblemPool(DEFAULT_SETTINGS).keys()]).toEqual(Array.from({ length: 17 }, (_, index) => index + 2))
  })
  for (let mask = 1; mask < 8; mask++) {
    const operators = OPERATORS.filter((_, index) => mask & (1 << index))
    it.each([false, true])(`enumerates ${operators.join(' ')} with allowZero=%s`, allowZero => {
      const pool = buildProblemPool({ ...DEFAULT_SETTINGS, operators, allowZero, maxOperand: 2 })
      const seen = new Set<string>()
      for (const [result, problems] of pool) {
        expect(result).toBeGreaterThanOrEqual(0)
        problems.forEach(problem => {
          expect(operators).toContain(problem.operator)
          expect(answer(problem)).toBe(result)
          expect(problem.a).toBeGreaterThanOrEqual(allowZero ? 0 : 1)
          expect(problem.b).toBeGreaterThanOrEqual(allowZero ? 0 : 1)
          expect(problem.a).toBeLessThanOrEqual(2)
          expect(problem.b).toBeLessThanOrEqual(2)
          const id = `${problem.a}${problem.operator}${problem.b}`
          expect(seen.has(id)).toBe(false)
          seen.add(id)
        })
      }
      for (const operator of operators) {
        for (let a = allowZero ? 0 : 1; a <= 2; a++) {
          for (let b = allowZero ? 0 : 1; b <= 2; b++) {
            expect(seen.has(`${a}${operator}${b}`)).toBe(operator !== '-' || a >= b)
          }
        }
      }
    })
  }
  it('allows subtraction zero even when zero operands are disabled', () => {
    const pool = buildProblemPool({ ...DEFAULT_SETTINGS, operators: ['-'] })
    expect(pool.get(0)).toHaveLength(9)
    expect(pool.has(-1)).toBe(false)
    expect(pool.get(0)?.some(problem => problem.a === 0 || problem.b === 0)).toBe(false)
  })
  it('supports maximum multiplication and zero operands', () => {
    const pool = buildProblemPool({ ...DEFAULT_SETTINGS, operators: ['*'], maxOperand: 99, allowZero: true })
    expect(pool.get(9801)).toEqual([{ a: 99, b: 99, operator: '*' }])
    expect(pool.get(0)).toHaveLength(199)
  })
  it.each([0, 1, 100, 9.5, NaN])('rejects max operand %s', maxOperand => {
    expect(() => assertSettings({ ...DEFAULT_SETTINGS, maxOperand })).toThrow('2 to 99')
  })
  it.each([0, 17, 1.5, NaN])('rejects color count %s', maxColors => {
    expect(() => assertSettings({ ...DEFAULT_SETTINGS, maxColors })).toThrow('1 to 16')
  })
  it.each(([[], ['+', '+']] satisfies Operator[][]).map(operators => ({ operators })))('rejects invalid operator sets $operators', ({ operators }) => {
    expect(() => assertSettings({ ...DEFAULT_SETTINGS, operators })).toThrow('operator')
  })
})
