import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { ViewMode } from './Worksheet'
import { userFacingError } from '../i18n/locale'
import type { UserFacingError } from '../i18n/locale'

export function usePrint() {
  const [mode, setMode] = useState<ViewMode>('puzzle')
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<UserFacingError | null>(null)
  const active = useRef(false)
  const request = useRef(0)

  useEffect(() => {
    const invalidate = () => { request.current++ }
    const finish = () => {
      invalidate()
      active.current = false
      setMode('puzzle')
      setPrinting(false)
    }
    window.addEventListener('afterprint', finish)
    return () => {
      invalidate()
      window.removeEventListener('afterprint', finish)
    }
  }, [])

  async function print(selectedMode: ViewMode) {
    if (active.current) return
    active.current = true
    const id = ++request.current
    setError(null)
    flushSync(() => {
      setMode(selectedMode)
      setPrinting(true)
    })
    try {
      await document.fonts.ready
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      if (id !== request.current) return
      window.print()
    } catch (cause) {
      if (id !== request.current) return
      active.current = false
      setMode('puzzle')
      setPrinting(false)
      setError(userFacingError(cause, 'printFailed'))
    }
  }

  return { mode, printing, error, print }
}
