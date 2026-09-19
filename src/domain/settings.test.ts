import { describe, expect, it } from 'vitest'
import { answer, assertSettings, buildProblemPool, DEFAULT_SETTINGS, MAX_RESULT, OPERATORS, problemText } from './settings'
import type { Operator } from './settings'

describe('difficulty settings', () => {
  it('retains default addition with the new result constraints', () => {
    expect(DEFAULT_SETTINGS).toEqual({ allowZero: false, maxOperand: 9, operators: ['+'], multiMap: true, maxColors: 8, maxResult: 99, allowZeroResults: false })
    expect([...buildProblemPool(DEFAULT_SETTINGS).keys()]).toEqual(Array.from({ length: 17 }, (_, index) => index + 2))
  })
  for (let mask = 1; mask < 8; mask++) {
    const operators = OPERATORS.filter((_, index) => mask & (1 << index))
    it.each([false, true])(`enumerates ${operators.join(' ')} with allowZero=%s`, allowZero => {
      const pool = buildProblemPool({ ...DEFAULT_SETTINGS, operators, allowZero, maxOperand: 2, allowZeroResults: true })
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
    const pool = buildProblemPool({ ...DEFAULT_SETTINGS, operators: ['-'], allowZeroResults: true })
    expect(pool.get(0)).toHaveLength(9)
    expect(pool.has(-1)).toBe(false)
    expect(pool.get(0)?.some(problem => problem.a === 0 || problem.b === 0)).toBe(false)
  })
  it('supports maximum multiplication and zero operands', () => {
    const pool = buildProblemPool({ ...DEFAULT_SETTINGS, operators: ['*'], maxOperand: 99, allowZero: true, allowZeroResults: true, maxResult: MAX_RESULT })
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
  it.each([-1, 9802, .5, NaN, Infinity])('rejects result limit %s', maxResult => {
    expect(() => assertSettings({ ...DEFAULT_SETTINGS, maxResult })).toThrow('0 to 9801')
  })
  it.each([0, 1, 3, 99, MAX_RESULT])('filters all operators at result maximum %s', maxResult => {
    for (const allowZero of [false, true]) {
      for (const allowZeroResults of [false, true]) {
        const pool = buildProblemPool({ ...DEFAULT_SETTINGS, operators: OPERATORS, maxOperand: 3, maxResult, allowZero, allowZeroResults })
        const expressions = new Set([...pool.values()].flat().map(problem => `${problem.a}${problem.operator}${problem.b}`))
        for (const operator of OPERATORS) {
          for (let a = allowZero ? 0 : 1; a <= 3; a++) {
            for (let b = allowZero ? 0 : 1; b <= 3; b++) {
              const result = operator === '+' ? a + b : operator === '-' ? a - b : a * b
              expect(expressions.has(`${a}${operator}${b}`)).toBe(result >= (allowZeroResults ? 0 : 1) && result <= maxResult)
            }
          }
        }
      }
    }
  })
  it('includes the maximum result and excludes the next value', () => {
    const pool = buildProblemPool({ ...DEFAULT_SETTINGS, maxOperand: 99, operators: OPERATORS })
    expect(pool.has(99)).toBe(true)
    expect(pool.has(100)).toBe(false)
    expect(pool.has(0)).toBe(false)
  })
  it('distinguishes zero operands from zero results and reports empty capacity', () => {
    expect(buildProblemPool({ ...DEFAULT_SETTINGS, operators: ['-'] }).has(0)).toBe(false)
    expect(buildProblemPool({ ...DEFAULT_SETTINGS, allowZero: true }).get(1)).toContainEqual({ a: 0, b: 1, operator: '+' })
    expect(buildProblemPool({ ...DEFAULT_SETTINGS, allowZero: true }).has(0)).toBe(false)
    expect(buildProblemPool({ ...DEFAULT_SETTINGS, maxResult: 1 }).size).toBe(0)
    expect(buildProblemPool({ ...DEFAULT_SETTINGS, maxResult: 0, allowZeroResults: true }).size).toBe(0)
    expect([...buildProblemPool({ ...DEFAULT_SETTINGS, maxResult: 0, allowZeroResults: true, operators: ['-'] }).keys()]).toEqual([0])
  })
  it('formats multiplication with a multiplication sign, not an asterisk', () => {
    expect(problemText({ a: 9, b: 8, operator: '*' })).toBe('9\u00d78')
    expect(problemText({ a: 3, b: 2, operator: '+' })).toBe('3+2')
    expect(problemText({ a: 3, b: 2, operator: '-' })).toBe('3-2')
  })
})
