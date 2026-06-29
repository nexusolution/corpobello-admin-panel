'use client'

import Link from 'next/link';

const Logo = () => {
  return (
    <Link href={'/'}>
      <img src='/images/logos/logo-icon.webp' alt='Corpo Bello' className='size-10' />
    </Link>
  )
}

export default Logo
