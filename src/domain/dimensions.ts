export function dimensionError(value: string): string | null {
  if (!/^\d+$/.test(value) || Number(value) < 4 || Number(value) > 24) {
    return 'Enter a whole number from 4 to 24.'
  }
  return null
}

export function assertDimensions(rows: number, columns: number): void {
  if (dimensionError(String(rows)) || dimensionError(String(columns))) {
    throw new Error('Rows and columns must be whole numbers from 4 to 24.')
  }
}
