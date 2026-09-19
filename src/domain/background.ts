import type { ColorGrid } from './palette'
import { isNearWhite } from './color'

// The caller validates the final, simplified grid before finding its background.
export function backgroundMask(grid: ColorGrid): readonly boolean[] {
  const nearWhite = grid.palette.map(isNearWhite)
  const mask = Array<boolean>(grid.assignments.length).fill(false)
  const pending: number[] = []
  function visit(index: number) {
    if (!mask[index] && nearWhite[grid.assignments[index]]) {
      mask[index] = true
      pending.push(index)
    }
  }
  for (let column = 0; column < grid.columns; column++) {
    visit(column)
    visit((grid.rows - 1) * grid.columns + column)
  }
  for (let row = 0; row < grid.rows; row++) {
    visit(row * grid.columns)
    visit((row + 1) * grid.columns - 1)
  }
  for (let cursor = 0; cursor < pending.length; cursor++) {
    const index = pending[cursor]
    const column = index % grid.columns
    if (column > 0) visit(index - 1)
    if (column < grid.columns - 1) visit(index + 1)
    if (index >= grid.columns) visit(index - grid.columns)
    if (index < (grid.rows - 1) * grid.columns) visit(index + grid.columns)
  }
  return mask
}
