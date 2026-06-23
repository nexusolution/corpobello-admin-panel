'use client'

import { Icon } from '@iconify/react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/dictionaries'

type LanguageOption = {
  code: Locale
  flag: string // iconify circle-flags icon
  /** Label shown in the dropdown — pulled from i18n so it follows current locale. */
  labelKey: 'language.english' | 'language.spanish'
  /** Region code shown in parentheses next to the label. */
  region: string
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', flag: 'circle-flags:gb', labelKey: 'language.english', region: 'UK' },
  { code: 'es', flag: 'circle-flags:ar', labelKey: 'language.spanish', region: 'AR' },
]

const Language = () => {
  const { locale, setLocale, t } = useTranslation()
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[1]

  return (
    <div className='relative group/menu px-15'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span
            aria-label={t(current.labelKey)}
            className='relative hover:text-primary rounded-full flex justify-center items-center cursor-pointer'>
            <Icon
              icon={current.flag}
              height={20}
              width={20}
              className='rounded-full h-5 w-5'
            />
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align='end' className='w-[200px] py-2 rounded-sm'>
          {LANGUAGES.map((lang) => {
            const isSelected = lang.code === locale
            return (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setLocale(lang.code)}
                className={`px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-lightprimary hover:text-primary ${
                  isSelected ? 'bg-lightprimary text-primary' : ''
                }`}>
                <Icon
                  icon={lang.flag}
                  height={20}
                  width={20}
                  className='rounded-full h-5 w-5'
                />
                <span className='text-sm'>
                  {t(lang.labelKey)}{' '}
                  <span className='text-xs text-darklink'>({lang.region})</span>
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default Language