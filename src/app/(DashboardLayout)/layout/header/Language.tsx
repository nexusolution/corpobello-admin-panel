'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

const languages = [
  { flag: '/images/svgs/icon-flag-en.svg', name: 'English', code: '(UK)' },
  { flag: '/images/svgs/icon-flag-fr.svg', name: 'French', code: '(FR)' },
  { flag: '/images/svgs/icon-flag-cn.svg', name: 'Chinese', code: '(CN)' },
  { flag: '/images/svgs/icon-flag-sa.svg', name: 'Arabic', code: '(SA)' },
]

const Language = () => {
  const [selected, setSelected] = useState(languages[0])

  return (
    <div className='relative group/menu px-15'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span className='relative hover:text-primary rounded-full flex justify-center items-center cursor-pointer'>
            <Image
              src={selected.flag}
              alt={selected.name}
              width={20}
              height={20}
              className='rounded-full object-cover h-5 w-5'
            />
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align='end' className='w-[200px] py-2 rounded-sm'>
          {languages.map((lang, index) => (
            <DropdownMenuItem
              key={index}
              onClick={() => setSelected(lang)}
              className='px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-lightprimary hover:text-primary'>
              <Image
                src={lang.flag}
                alt={lang.name}
                width={20}
                height={20}
                className='rounded-full object-cover h-5 w-5'
              />
              <span className='text-sm'>
                {lang.name}{' '}
                <span className='text-xs text-darklink'>{lang.code}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default Language
