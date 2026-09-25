import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadImage, MAX_FILE_SIZE, processImage, validateFile, validateImageDimensions } from './process'

const { resize } = vi.hoisted(() => ({ resize: vi.fn().mockResolvedValue(undefined) }))
vi.mock('pica', () => ({ default: () => ({ resize }) }))

describe('image input validation', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('accepts %s', type => {
    expect(() => validateFile({ type, size: MAX_FILE_SIZE })).not.toThrow()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function bitmap(width = 4, height = 3) {
    return { width, height, close: vi.fn() } as unknown as ImageBitmap
  }

  function imageEnvironment(points: readonly [number, number][] = [[1, 1], [2, 1]]) {
    const original = bitmap()
    const cropped = bitmap(2, 1)
    const decode = vi.fn().mockResolvedValueOnce(original).mockResolvedValue(cropped)
    vi.stubGlobal('createImageBitmap', decode)
    const contexts: ReturnType<typeof makeContext>[] = []
    function makeContext() {
      return {
        fillStyle: '', imageSmoothingEnabled: true, imageSmoothingQuality: 'high',
        fillRect: vi.fn(), drawImage: vi.fn(),
        getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => {
          const data = new Uint8ClampedArray(width * height * 4).fill(255)
          for (const [x, y] of points) {
            if (x < width && y < height) data.set([0, 0, 0, 255], (y * width + x) * 4)
          }
          return { data }
        }),
      }
    }
    const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(['preview'])))
    const createElement = vi.fn(() => {
      const context = makeContext()
      contexts.push(context)
      return { width: 0, height: 0, getContext: vi.fn(() => context), toBlob }
    })
    vi.stubGlobal('document', { createElement })
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const file = new File(['original file bytes'], 'test.png', { type: 'image/png' })
    return { original, cropped, decode, contexts, toBlob, createElement, createUrl, revokeUrl, file }
  }

  describe('loading processed images', () => {
    it('defaults to an uncropped image without scanning pixels', async () => {
      const env = imageEnvironment()
      const image = await loadImage(env.file)
      expect(image.bitmap).toBe(env.original)
      expect(image.file).toBe(env.file)
      expect(image.name).toBe(env.file.name)
      expect(image.originalWidth).toBe(4)
      expect(image.originalHeight).toBe(3)
      expect(image.trim).toEqual({
        enabled: false, bounds: { x: 0, y: 0, width: 4, height: 3 }, noForeground: false,
      })
      expect(env.decode).toHaveBeenCalledExactlyOnceWith(env.file, { imageOrientation: 'from-image' })
      expect(env.contexts[0].getImageData).not.toHaveBeenCalled()
      expect(env.original.close).not.toHaveBeenCalled()
      image.dispose()
      image.dispose()
      expect(env.original.close).toHaveBeenCalledTimes(1)
      expect(env.revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:preview')
    })

    it('crops exact integer bounds and previews the crop while retaining original metadata and file', async () => {
      const env = imageEnvironment()
      const image = await loadImage(env.file, true)
      expect(image.bitmap).toBe(env.cropped)
      expect(image.file).toBe(env.file)
      expect(image.originalWidth).toBe(4)
      expect(image.originalHeight).toBe(3)
      expect(image.trim).toEqual({
        enabled: true, bounds: { x: 1, y: 1, width: 2, height: 1 }, noForeground: false,
      })
      expect(env.decode).toHaveBeenNthCalledWith(2, env.original, 1, 1, 2, 1)
      expect(env.original.close).toHaveBeenCalledTimes(1)
      expect(env.cropped.close).not.toHaveBeenCalled()
      expect(env.contexts[1].drawImage).toHaveBeenCalledExactlyOnceWith(env.cropped, 0, 0, 2, 1)
      image.dispose()
      expect(env.original.close).toHaveBeenCalledTimes(1)
      expect(env.cropped.close).toHaveBeenCalledTimes(1)
    })

    it.each([
      { points: [] as [number, number][], noForeground: true },
      { points: [[0, 0], [3, 2]] as [number, number][], noForeground: false },
    ])('reuses the original when bounds stay unchanged ($noForeground)', async ({ points, noForeground }) => {
      const env = imageEnvironment(points)
      const image = await loadImage(env.file, true)
      expect(image.bitmap).toBe(env.original)
      expect(image.trim).toEqual({
        enabled: true, bounds: { x: 0, y: 0, width: 4, height: 3 }, noForeground,
      })
      expect(env.decode).toHaveBeenCalledTimes(1)
      expect(env.original.close).not.toHaveBeenCalled()
      image.dispose()
    })

    it('reports decode errors without creating resources', async () => {
      const env = imageEnvironment()
      env.decode.mockReset().mockRejectedValue(new Error('bad data'))
      await expect(loadImage(env.file)).rejects.toMatchObject({ code: 'decodeFailed' })
      expect(env.createElement).not.toHaveBeenCalled()
      expect(env.createUrl).not.toHaveBeenCalled()
    })

    it('closes oversized decoded images before canvas allocation', async () => {
      const env = imageEnvironment()
      const oversized = bitmap(8001, 5000)
      env.decode.mockReset().mockResolvedValue(oversized)
      await expect(loadImage(env.file, true)).rejects.toThrow('40 million')
      expect(oversized.close).toHaveBeenCalledTimes(1)
      expect(env.createElement).not.toHaveBeenCalled()
    })

    it('closes the original if cropping fails', async () => {
      const env = imageEnvironment()
      env.decode.mockReset().mockResolvedValueOnce(env.original).mockRejectedValue(new Error('crop failed'))
      await expect(loadImage(env.file, true)).rejects.toThrow('crop failed')
      expect(env.original.close).toHaveBeenCalledTimes(1)
      expect(env.createUrl).not.toHaveBeenCalled()
    })

    it('keeps the original alive until replacement is ready, then cleans up both after abort', async () => {
      const env = imageEnvironment()
      const controller = new AbortController()
      env.decode.mockReset().mockResolvedValueOnce(env.original).mockImplementationOnce(async () => {
        expect(env.original.close).not.toHaveBeenCalled()
        controller.abort()
        return env.cropped
      })
      await expect(loadImage(env.file, true, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
      expect(env.original.close).toHaveBeenCalledTimes(1)
      expect(env.cropped.close).toHaveBeenCalledTimes(1)
      expect(env.createUrl).not.toHaveBeenCalled()
    })

    it('does not decode an already cancelled request', async () => {
      const env = imageEnvironment()
      await expect(loadImage(env.file, true, AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' })
      expect(env.decode).not.toHaveBeenCalled()
    })

    it('closes an image decoded after cancellation', async () => {
      const env = imageEnvironment()
      const controller = new AbortController()
      env.decode.mockReset().mockImplementation(async () => {
        controller.abort()
        return env.original
      })
      await expect(loadImage(env.file, true, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
      expect(env.original.close).toHaveBeenCalledTimes(1)
      expect(env.createElement).not.toHaveBeenCalled()
    })

    it.each([false, true])('cleans up failed preview creation (trim %s)', async trim => {
      const env = imageEnvironment()
      env.toBlob.mockImplementation(callback => callback(null))
      await expect(loadImage(env.file, trim)).rejects.toMatchObject({ code: 'previewFailed' })
      expect(env.original.close).toHaveBeenCalledTimes(1)
      expect(env.cropped.close).toHaveBeenCalledTimes(trim ? 1 : 0)
      expect(env.createUrl).not.toHaveBeenCalled()
    })

    it('does not create a URL when cancellation happens during preview encoding', async () => {
      const env = imageEnvironment()
      const controller = new AbortController()
      env.toBlob.mockImplementation(callback => {
        controller.abort()
        callback(new Blob(['preview']))
      })
      await expect(loadImage(env.file, true, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
      expect(env.original.close).toHaveBeenCalledTimes(1)
      expect(env.cropped.close).toHaveBeenCalledTimes(1)
      expect(env.createUrl).not.toHaveBeenCalled()
    })
  })

  describe('trimmed processing diagnostics', () => {
    it('gives Pica an owned clone of the crop and only closes that clone during processing', async () => {
      const env = imageEnvironment()
      const clone = bitmap(2, 1)
      env.decode.mockReset().mockResolvedValueOnce(env.original)
        .mockResolvedValueOnce(env.cropped).mockResolvedValueOnce(clone)
      resize.mockClear()
      const image = await loadImage(env.file, true)
      const result = await processImage(image, 4, 4)
      expect(env.decode).toHaveBeenNthCalledWith(3, env.cropped)
      expect(resize).toHaveBeenCalledExactlyOnceWith(clone, expect.objectContaining({ width: 4, height: 2 }), {
        filter: 'mks2013', cancelToken: undefined,
      })
      expect(clone.close).toHaveBeenCalledTimes(1)
      expect(env.cropped.close).not.toHaveBeenCalled()
      expect(result.diagnostics).toMatchObject({
        sourceWidth: 4, sourceHeight: 3, inputWidth: 2, inputHeight: 1,
        requestedAlgorithm: 'pica', appliedAlgorithm: 'pica',
      })
      image.dispose()
    })

    it('fits the cropped bitmap but keeps source dimensions tied to original file bytes', async () => {
      const env = imageEnvironment()
      const image = await loadImage(env.file, true)
      const result = await processImage(image, 4, 4, 8, 'nearest')
      expect(result.diagnostics).toMatchObject({
        pipelineVersion: '2', sourceWidth: 4, sourceHeight: 3, inputWidth: 2, inputHeight: 1,
        trim: image.trim, fittedBounds: { x: 0, y: 1, width: 4, height: 2 },
      })
      expect(env.contexts[2].drawImage).toHaveBeenCalledExactlyOnceWith(env.cropped, 0, 1, 4, 2)
      image.dispose()
    })

    it('omits additive diagnostic fields when trimming is disabled', async () => {
      const env = imageEnvironment()
      const image = await loadImage(env.file)
      const result = await processImage(image, 4, 4, 8, 'nearest')
      expect(result.diagnostics.sourceWidth).toBe(4)
      expect(result.diagnostics.sourceHeight).toBe(3)
      expect(result.diagnostics).not.toHaveProperty('trim')
      expect(result.diagnostics).not.toHaveProperty('inputWidth')
      expect(result.diagnostics).not.toHaveProperty('inputHeight')
      image.dispose()
    })
  })
  it('rejects unsupported, empty and oversized files', () => {
    expect(() => validateFile({ type: 'image/svg+xml', size: 100 })).toThrow('PNG')
    expect(() => validateFile({ type: 'image/png', size: 0 })).toThrow('empty')
    expect(() => validateFile({ type: 'image/png', size: MAX_FILE_SIZE + 1 })).toThrow('10 MiB')
  })
  it('guards decoded dimensions before canvas allocation', () => {
    expect(() => validateImageDimensions(8000, 5000)).not.toThrow()
    expect(() => validateImageDimensions(8001, 5000)).toThrow('40 million')
    expect(() => validateImageDimensions(0, 20)).toThrow('invalid')
  })
})
