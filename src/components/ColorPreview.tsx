import { toHex } from '../domain/color'
import type { ColorGrid } from '../domain/palette'

export function ColorPreview({ grid }: { grid: ColorGrid }) {
  return (
    <svg className="color-preview" role="img" aria-label={`Pixel picture with ${grid.rows} rows, ${grid.columns} columns and ${grid.palette.length} colors`} viewBox={`0 0 ${grid.columns} ${grid.rows}`}>
      {grid.assignments.map((color, index) => <rect key={index} x={index % grid.columns} y={Math.floor(index / grid.columns)} width="1" height="1" fill={toHex(grid.palette[color])} />)}
    </svg>
  )
}
