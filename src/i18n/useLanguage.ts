import { createContext, useContext } from 'react'
import type { Messages } from './en'
import type { Language } from './locale'

interface LanguageContextValue {
  language: Language
  messages: Messages
  storageUnavailable: boolean
  setLanguage(language: Language): void
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('LanguageProvider is required.')
  return context
}
