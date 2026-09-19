import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { catalogs, detectLanguage, isLanguage, LANGUAGE_STORAGE_KEY } from './locale'
import type { Language } from './locale'
import { LanguageContext } from './useLanguage'

function initialPreference() {
  const detected = detectLanguage(navigator.languages.length ? navigator.languages : [navigator.language])
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return { language: isLanguage(saved) ? saved : detected, storageUnavailable: false }
  } catch (cause) {
    if (!(cause instanceof DOMException)) throw cause
    console.warn('Could not read the language preference.', cause)
    return { language: detected, storageUnavailable: true }
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(initialPreference)
  const messages = catalogs[preference.language]

  useEffect(() => {
    document.documentElement.lang = preference.language
    document.title = messages.pageTitle
    document.querySelector('meta[name="description"]')?.setAttribute('content', messages.pageDescription)
  }, [preference.language, messages])

  function setLanguage(language: Language) {
    let storageUnavailable = false
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch (cause) {
      if (!(cause instanceof DOMException)) throw cause
      console.warn('Could not save the language preference.', cause)
      storageUnavailable = true
    }
    setPreference({ language, storageUnavailable })
  }

  return <LanguageContext.Provider value={{ ...preference, messages, setLanguage }}>{children}</LanguageContext.Provider>
}
