import { toHex } from '../domain/color'
import type { ColorGrid } from '../domain/palette'
import { useLanguage } from '../i18n/useLanguage'

export function ColorPreview({ grid }: { grid: ColorGrid }) {
  const { messages: t } = useLanguage()
  return (
    <svg className="color-preview" role="img" aria-label={t.pixelPicture(grid.rows, grid.columns, grid.palette.length)} viewBox={`0 0 ${grid.columns} ${grid.rows}`}>
      {grid.assignments.map((color, index) => <rect key={index} x={index % grid.columns} y={Math.floor(index / grid.columns)} width="1" height="1" fill={toHex(grid.palette[color])} />)}
    </svg>
  )
}
