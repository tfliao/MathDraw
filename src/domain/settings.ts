export const OPERATORS = ['+', '-', '*'] as const
export type Operator = typeof OPERATORS[number]
export const DEFAULT_MAX_COLORS = 8
export const MAX_COLORS = 16

export interface PuzzleSettings {
  readonly allowZero: boolean
  readonly maxOperand: number
  readonly operators: readonly Operator[]
  readonly multiMap: boolean
  readonly maxColors: number
}

export const DEFAULT_SETTINGS: PuzzleSettings = Object.freeze({
  allowZero: false, maxOperand: 9, operators: Object.freeze<Operator[]>(['+']),
  multiMap: false, maxColors: DEFAULT_MAX_COLORS,
})

export function settingsErrors(settings: PuzzleSettings) {
  return {
    maxOperand: !Number.isInteger(settings.maxOperand) || settings.maxOperand < 2 || settings.maxOperand > 99 ? 'Enter a whole number from 2 to 99.' : null,
    operators: settings.operators.length === 0 || settings.operators.some(operator => !OPERATORS.includes(operator)) ||
      new Set(settings.operators).size !== settings.operators.length ? 'Choose at least one operator, without duplicates.' : null,
    maxColors: !Number.isInteger(settings.maxColors) || settings.maxColors < 1 || settings.maxColors > MAX_COLORS ? 'Enter a whole number from 1 to 16.' : null,
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
  return `${problem.a}${problem.operator}${problem.b}`
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
        if (result < 0) continue
        const problems = pool.get(result)
        if (problems) problems.push(problem)
        else pool.set(result, [problem])
      }
    }
  }
  return pool
}
