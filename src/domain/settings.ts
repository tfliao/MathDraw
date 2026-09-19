import { en } from '../i18n/en'
import type { Messages } from '../i18n/en'

export const OPERATORS = ['+', '-', '*'] as const
export type Operator = typeof OPERATORS[number]
export const RESIZE_ALGORITHMS = ['pica', 'nearest', 'browser', 'foreground'] as const
export type ResizeAlgorithm = typeof RESIZE_ALGORITHMS[number]

export function isResizeAlgorithm(value: unknown): value is ResizeAlgorithm {
  return RESIZE_ALGORITHMS.some(algorithm => algorithm === value)
}

export const DEFAULT_MAX_COLORS = 8
export const MAX_COLORS = 16
export const MAX_RESULT = 99 * 99
export const NO_RESULTS_MESSAGE = en.noResults

export interface PuzzleSettings {
  readonly allowZero: boolean
  readonly maxOperand: number
  readonly operators: readonly Operator[]
  readonly multiMap: boolean
  readonly maxResultsPerColor: number
  readonly skipBackground: boolean
  readonly maxColors: number
  readonly maxResult: number
  readonly allowZeroResults: boolean
  readonly resizeAlgorithm: ResizeAlgorithm
  readonly mergeSimilarColors: boolean
}

export const DEFAULT_SETTINGS: PuzzleSettings = Object.freeze({
  allowZero: false, maxOperand: 9, operators: Object.freeze<Operator[]>(['+']),
  multiMap: true, maxColors: DEFAULT_MAX_COLORS, maxResult: 99, allowZeroResults: false,
  maxResultsPerColor: 3, skipBackground: false,
  resizeAlgorithm: 'pica', mergeSimilarColors: false,
})

export function settingsErrors(settings: PuzzleSettings, messages: Messages = en) {
  return {
    maxOperand: !Number.isInteger(settings.maxOperand) || settings.maxOperand < 2 || settings.maxOperand > 99 ? messages.wholeNumber(2, 99) : null,
    operators: settings.operators.length === 0 || settings.operators.some(operator => !OPERATORS.includes(operator)) ||
      new Set(settings.operators).size !== settings.operators.length ? messages.invalidOperators : null,
    maxColors: !Number.isInteger(settings.maxColors) || settings.maxColors < 1 || settings.maxColors > MAX_COLORS ? messages.wholeNumber(1, MAX_COLORS) : null,
    maxResult: !Number.isInteger(settings.maxResult) || settings.maxResult < 0 || settings.maxResult > MAX_RESULT ? messages.wholeNumber(0, MAX_RESULT) : null,
    maxResultsPerColor: !Number.isInteger(settings.maxResultsPerColor) || settings.maxResultsPerColor < 1 || settings.maxResultsPerColor > 8 ? messages.wholeNumber(1, 8) : null,
    resizeAlgorithm: !isResizeAlgorithm(settings.resizeAlgorithm) ? messages.invalidResizeAlgorithm : null,
  }
}

export function assertSettings(settings: PuzzleSettings): void {
  const error = Object.values(settingsErrors(settings)).find(Boolean)
  if (error) throw new Error(error)
}

export interface MathProblem {
  readonly a: number
  readonly b: number
  readonly operator: Operator
}

export function answer(problem: MathProblem): number {
  switch (problem.operator) {
    case '+': return problem.a + problem.b
    case '-': return problem.a - problem.b
    case '*': return problem.a * problem.b
  }
}

export function problemText(problem: MathProblem): string {
  return `${problem.a}${operatorSymbol(problem.operator)}${problem.b}`
}

export function operatorSymbol(operator: Operator): string {
  return operator === '*' ? '\u00d7' : operator
}

export function buildProblemPool(settings: PuzzleSettings): ReadonlyMap<number, readonly MathProblem[]> {
  assertSettings(settings)
  const pool = new Map<number, MathProblem[]>()
  const minimum = settings.allowZero ? 0 : 1
  for (const operator of OPERATORS.filter(operator => settings.operators.includes(operator))) {
    for (let a = minimum; a <= settings.maxOperand; a++) {
      for (let b = minimum; b <= settings.maxOperand; b++) {
        const problem = { a, b, operator }
        const result = answer(problem)
        if (result < 0 || result > settings.maxResult || (result === 0 && !settings.allowZeroResults)) continue
        const problems = pool.get(result)
        if (problems) problems.push(problem)
        else pool.set(result, [problem])
      }
    }
  }
  return pool
}
