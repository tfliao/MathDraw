import { useEffect, useRef, useState } from 'react'
import { loadImage } from './process'
import type { LoadedImage } from './process'
import { userFacingError } from '../i18n/locale'
import type { UserFacingError } from '../i18n/locale'

export function useImageInput() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<UserFacingError | null>(null)
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
    setError(null)
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
      if (id === request.current) setError(userFacingError(cause, 'loadFailed'))
    } finally {
      if (id === request.current) setLoading(false)
    }
  }

  return { image, loading, error, selectFile }
}
