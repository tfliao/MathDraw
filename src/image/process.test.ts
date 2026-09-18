import { describe, expect, it } from 'vitest'
import { MAX_FILE_SIZE, validateFile, validateImageDimensions } from './process'

describe('image input validation', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('accepts %s', type => {
    expect(() => validateFile({ type, size: MAX_FILE_SIZE })).not.toThrow()
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
