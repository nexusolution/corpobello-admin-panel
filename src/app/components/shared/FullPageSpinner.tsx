import { Icon } from '@iconify/react'

// Full-viewport centered spinner. Used before the dashboard shell exists — the
// auth gate (while the Supabase session resolves) and the auth routes — where
// there's no sidebar/header to frame a content skeleton.
export function FullPageSpinner() {
  return (
    <div
      className='min-h-screen w-full flex items-center justify-center bg-background'
      aria-busy='true'
      aria-live='polite'>
      <Icon
        icon='tabler:loader-2'
        height={40}
        width={40}
        className='text-primary animate-spin'
      />
    </div>
  )
}

export default FullPageSpinner
