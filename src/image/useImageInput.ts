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
  const selected = useRef<File | undefined>(undefined)
  const trimming = useRef(false)
  const operation = useRef<AbortController | null>(null)

  useEffect(() => () => {
    request.current++
    operation.current?.abort()
    active.current?.dispose()
    active.current = null
  }, [])

  async function prepare(file: File | undefined) {
    const id = ++request.current
    operation.current?.abort()
    const controller = new AbortController()
    operation.current = controller
    active.current?.dispose()
    active.current = null
    setImage(null)
    setError(null)
    setLoading(Boolean(file))
    if (!file) return
    try {
      const result = await loadImage(file, trimming.current, controller.signal)
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

  function selectFile(file: File | undefined) {
    selected.current = file
    return prepare(file)
  }

  function setTrimMargins(enabled: boolean) {
    trimming.current = enabled
    return prepare(selected.current)
  }

  return { image, loading, error, selectFile, setTrimMargins }
}
