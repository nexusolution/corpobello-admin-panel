// Content skeleton shown while a page's content loads (Next.js route-segment
// loading fallback). Lives inside the DashboardLayout, so the sidebar/header
// stay put and only the content area animates — no more blank white flash on
// navigation.

function SkelBar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted/70 dark:bg-darkmuted/60 ${className}`}
    />
  )
}

function SkelCard() {
  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5'>
      <SkelBar className='h-4 w-1/3 mb-4' />
      <SkelBar className='h-8 w-1/2 mb-3' />
      <SkelBar className='h-24 w-full' />
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className='space-y-6' aria-busy='true' aria-live='polite'>
      {/* Title area */}
      <div className='space-y-2'>
        <SkelBar className='h-6 w-56' />
        <SkelBar className='h-4 w-80' />
      </div>

      {/* Card grid */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
        <SkelCard />
        <SkelCard />
        <SkelCard />
      </div>

      {/* Wide block */}
      <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5'>
        <SkelBar className='h-4 w-40 mb-4' />
        <div className='space-y-3'>
          <SkelBar className='h-10 w-full' />
          <SkelBar className='h-10 w-full' />
          <SkelBar className='h-10 w-5/6' />
        </div>
      </div>
    </div>
  )
}

export default PageSkeleton
