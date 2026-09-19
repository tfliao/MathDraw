export const MAX_COLUMNS = 64
export const MAX_ROWS = MAX_COLUMNS
export const MAX_CELLS = MAX_ROWS * MAX_COLUMNS

export function dimensionError(value: string, axis: 'rows' | 'columns' = 'rows'): string | null {
  const maximum = axis === 'rows' ? MAX_ROWS : MAX_COLUMNS
  if (!/^\d+$/.test(value) || Number(value) < 4 || Number(value) > maximum) {
    return `Enter a whole number from 4 to ${maximum}.`
  }
  return null
}

export function assertDimensions(rows: number, columns: number): void {
  if (dimensionError(String(rows)) || dimensionError(String(columns), 'columns')) {
    throw new Error('Rows and columns must be whole numbers from 4 to 64.')
  }
}

export function autoDimensions(width: number, height: number): { rows: number; columns: number } {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Image dimensions must be positive finite numbers.')
  }
  const scale = 24 / Math.max(width, height)
  return {
    rows: Math.max(4, Math.round(height * scale)),
    columns: Math.max(4, Math.round(width * scale)),
  }
}
