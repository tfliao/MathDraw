import { toHex } from '../domain/color'
import type { ColorGrid } from '../domain/palette'
import { useLanguage } from '../i18n/useLanguage'

export function ColorPreview({ grid, backgroundCells }: { grid: ColorGrid; backgroundCells?: readonly boolean[] }) {
  const { messages: t } = useLanguage()
  const fills = grid.assignments.map((color, index) => backgroundCells?.[index] ? '#ffffff' : toHex(grid.palette[color]))
  return (
    <svg className="color-preview" role="img" aria-label={t.pixelPicture(grid.rows, grid.columns, new Set(fills).size)} viewBox={`0 0 ${grid.columns} ${grid.rows}`}>
      {fills.map((fill, index) => <rect key={index} x={index % grid.columns} y={Math.floor(index / grid.columns)} width="1" height="1" fill={fill} />)}
    </svg>
  )
}
