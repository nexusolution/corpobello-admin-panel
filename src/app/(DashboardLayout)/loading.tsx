import { PageSkeleton } from '@/app/components/shared/PageSkeleton'

// Route-segment loading UI for every page under the dashboard. Next.js renders
// this (inside the layout, so sidebar + header stay) while a page's server
// component streams, replacing the previous blank flash on navigation.
export default function Loading() {
  return <PageSkeleton />
}
