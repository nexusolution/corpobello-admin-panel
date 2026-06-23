'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { dictionaries, type Locale, type TranslationKey } from './dictionaries'

const STORAGE_KEY = 'panel-lang'
const DEFAULT_LOCALE: Locale = 'es'

type LanguageContextValue = {
  locale: Locale
  setLocale: (next: Locale) => void
  t: (key: TranslationKey, params?: Record<string, string>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Start with default to avoid SSR/CSR mismatch; hydrate from localStorage in effect.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'es' || stored === 'en') {
        setLocaleState(stored)
      }
    } catch {
      // localStorage unavailable (private mode, SSR edge) — fall back to default.
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string>) => {
      const raw = dictionaries[locale][key] ?? key
      if (!params) return raw
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, v),
        raw as string
      )
    },
    [locale]
  )

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useTranslation must be used inside <LanguageProvider>')
  }
  return ctx
}