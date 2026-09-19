import { en } from './en'
import type { Messages } from './en'
import { zhTW } from './zh-TW'

export type Language = 'en' | 'zh-TW'
export const LANGUAGE_STORAGE_KEY = 'mathdraw.language'
export const catalogs: Record<Language, Messages> = { en, 'zh-TW': zhTW }

export function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'zh-TW'
}

export function detectLanguage(preferences: readonly string[]): Language {
  for (const preference of preferences) {
    const base = preference.toLowerCase().split('-')[0]
    if (base === 'zh') return 'zh-TW'
    if (base === 'en') return 'en'
  }
  return 'en'
}

export type MessageCode = {
  [Key in keyof Messages]: Messages[Key] extends string ? Key : never
}[keyof Messages]

export class UserFacingError extends Error {
  readonly code: MessageCode

  constructor(code: MessageCode) {
    super(en[code])
    this.name = 'UserFacingError'
    this.code = code
  }
}

export function userFacingError(cause: unknown, fallback: MessageCode): UserFacingError {
  if (cause instanceof UserFacingError) return cause
  console.error(cause)
  return new UserFacingError(fallback)
}
