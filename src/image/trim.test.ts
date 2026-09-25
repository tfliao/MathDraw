import { afterEach, describe, expect, it, vi } from 'vitest'
import { findTrimBounds, foregroundBounds, mergeBounds } from './trim'

function pixels(width: number, height: number, points: readonly [number, number][] = []) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (const [x, y] of points) data.set([0, 0, 0, 255], (y * width + x) * 4)
  return data
}

afterEach(() => vi.unstubAllGlobals())

describe('foreground bounds', () => {
  it.each([[255, 255, 255], [240, 240, 240], [250, 245, 240]])('ignores white/pale RGB %j', (r, g, b) => {
    expect(foregroundBounds(new Uint8ClampedArray([r, g, b, 255]), 1, 1)).toBeNull()
  })

  it.each([[239, 255, 255], [255, 239, 255], [255, 255, 239]])('keeps any channel below 240: %j', (r, g, b) => {
    expect(foregroundBounds(new Uint8ClampedArray([r, g, b, 255]), 1, 1)).toEqual({
      x: 0, y: 0, width: 1, height: 1,
    })
  })

  it('uses inclusive one-pixel bounds with tile offsets', () => {
    expect(foregroundBounds(pixels(5, 4, [[4, 3]]), 5, 4, 512, 1024)).toEqual({
      x: 516, y: 1027, width: 1, height: 1,
    })
  })

  it('keeps enclosed background holes and isolated foreground noise', () => {
    expect(foregroundBounds(pixels(8, 7, [[2, 2], [4, 2], [2, 4], [4, 4], [7, 6]]), 8, 7)).toEqual({
      x: 2, y: 2, width: 6, height: 5,
    })
  })

  it('merges tile bounds and ignores background-only tiles', () => {
    const first = foregroundBounds(pixels(3, 3, [[2, 2]]), 3, 3)
    const second = foregroundBounds(pixels(3, 3, [[0, 0]]), 3, 3, 512, 512)
    expect(mergeBounds(first, second)).toEqual({ x: 2, y: 2, width: 511, height: 511 })
    expect(mergeBounds(first, null)).toEqual(first)
    expect(mergeBounds(null, second)).toEqual(second)
    expect(mergeBounds(null, null)).toBeNull()
  })
})

function mockCanvas(points: readonly [number, number][] = []) {
  let sourceX = 0
  let sourceY = 0
  const context = {
    fillStyle: '',
    imageSmoothingEnabled: true,
    fillRect: vi.fn(),
    drawImage: vi.fn((
      _bitmap: ImageBitmap, x: number, y: number, _width: number, _height: number,
      _dx: number, _dy: number, _dw: number, _dh: number,
    ) => { sourceX = x; sourceY = y }),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
      data: pixels(width, height, points
        .filter(([x, y]) => x >= sourceX && x < sourceX + width && y >= sourceY && y < sourceY + height)
        .map(([x, y]) => [x - sourceX, y - sourceY])),
    })),
  }
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) }
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
  return { context, canvas }
}

describe('tiled bitmap scanning', () => {
  it('bounds allocation, composites every tile white and never resamples', async () => {
    const { canvas, context } = mockCanvas([[512, 511], [1024, 512]])
    const bitmap = { width: 1025, height: 513 } as ImageBitmap
    expect(await findTrimBounds(bitmap)).toEqual({
      bounds: { x: 512, y: 511, width: 513, height: 2 }, noForeground: false,
    })
    expect(canvas.width).toBe(512)
    expect(canvas.height).toBe(512)
    expect(context.imageSmoothingEnabled).toBe(false)
    expect(context.fillStyle).toBe('#ffffff')
    expect(context.fillRect).toHaveBeenCalledTimes(6)
    for (const [index, call] of context.drawImage.mock.calls.entries()) {
      expect(call).toEqual([bitmap, call[1], call[2], expect.any(Number), expect.any(Number), 0, 0, call[3], call[4]])
      expect(context.fillRect.mock.invocationCallOrder[index]).toBeLessThan(context.drawImage.mock.invocationCallOrder[index])
    }
    expect(context.drawImage).toHaveBeenLastCalledWith(bitmap, 1024, 512, 1, 1, 0, 0, 1, 1)
  })

  it('preserves original bounds when there is no foreground', async () => {
    mockCanvas()
    expect(await findTrimBounds({ width: 3, height: 2 } as ImageBitmap)).toEqual({
      bounds: { x: 0, y: 0, width: 3, height: 2 }, noForeground: true,
    })
  })

  it('yields between tiles and stops after cancellation', async () => {
    const { context } = mockCanvas()
    const controller = new AbortController()
    const pending = findTrimBounds({ width: 1025, height: 513 } as ImageBitmap, controller.signal)
    expect(context.drawImage).toHaveBeenCalledTimes(1)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(context.drawImage).toHaveBeenCalledTimes(1)
  })

  it('does not allocate a canvas for a cancelled scan', async () => {
    mockCanvas()
    await expect(findTrimBounds({ width: 3, height: 2 } as ImageBitmap, AbortSignal.abort()))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(document.createElement).not.toHaveBeenCalled()
  })
})
