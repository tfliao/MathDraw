import { useEffect, useRef, useState } from 'react'
import { loadImage } from './process'
import type { LoadedImage } from './process'

export function useImageInput() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<LoadedImage | null>(null)
  const request = useRef(0)

  useEffect(() => () => {
    request.current++
    active.current?.dispose()
    active.current = null
  }, [])

  async function selectFile(file: File | undefined) {
    const id = ++request.current
    active.current?.dispose()
    active.current = null
    setImage(null)
    setError('')
    setLoading(Boolean(file))
    if (!file) return
    try {
      const result = await loadImage(file)
      if (id !== request.current) {
        result.dispose()
        return
      }
      active.current = result
      setImage(result)
    } catch (cause) {
      if (id === request.current) setError(cause instanceof Error ? cause.message : 'Could not load this picture. Please try again.')
    } finally {
      if (id === request.current) setLoading(false)
    }
  }

  return { image, loading, error, selectFile }
}
