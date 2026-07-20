import { FullPageSpinner } from '@/app/components/shared/FullPageSpinner'

// Root-level catch-all loading fallback for the initial app load and any
// segment without its own loading.tsx — a spinner rather than a white screen.
export default function Loading() {
  return <FullPageSpinner />
}
