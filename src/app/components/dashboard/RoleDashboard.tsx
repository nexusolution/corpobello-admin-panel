'use client'

import DashboardGreeting from './DashboardGreeting'
import TopCards from './TopCards'
import { WelcomeBanner } from './WelcomeBanner'
import QuickAccess from './QuickAccess'
import AgendaDay from './AgendaDay'
import TasksAttention from './TasksAttention'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'

// Andrés 2026-06-30, point #5: the same dashboard, reprioritised per role.
// Every role sees the greeting first; below it the cards are reordered so the
// first thing each person sees is the work THEY act on:
//
// - admin      → business overview first (funnel KPIs), then agenda + tasks.
// - operador   → front-desk action first (agenda to confirm + attention queue),
//                then the funnel, then quick access. Andrés' priority: the
//                secretary works the queue, not the KPIs.
// - profesional→ clinical view: their agenda + today's load, then pending
//                records. No sales funnel, no CRM quick-access (not their job).
//
// The card components are self-contained and still read mock data; this only
// changes WHICH cards appear and in what order. Wiring the numbers to Supabase
// is a separate step.
export function RoleDashboard() {
  const { role, loading } = useCurrentUser()

  // While the role resolves, render the admin (superset) layout so no card
  // pops in late; once known, non-admin roles settle into their own view.
  const view = loading ? 'admin' : role

  if (view === 'profesional') {
    return (
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <DashboardGreeting />
        </div>
        <div className='col-span-12 lg:col-span-8'>
          <AgendaDay />
        </div>
        <div className='col-span-12 lg:col-span-4'>
          <WelcomeBanner />
        </div>
        <div className='col-span-12'>
          <TasksAttention />
        </div>
      </div>
    )
  }

  if (view === 'operador') {
    return (
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <DashboardGreeting />
        </div>
        <div className='col-span-12 lg:col-span-6'>
          <AgendaDay />
        </div>
        <div className='col-span-12 lg:col-span-6'>
          <TasksAttention />
        </div>
        <div className='col-span-12'>
          <TopCards />
        </div>
        <div className='col-span-12 lg:col-span-8'>
          <WelcomeBanner />
        </div>
        <div className='col-span-12 lg:col-span-4'>
          <QuickAccess />
        </div>
      </div>
    )
  }

  // admin (and the loading superset)
  return (
    <div className='grid grid-cols-12 gap-6'>
      <div className='col-span-12'>
        <DashboardGreeting />
      </div>
      <div className='col-span-12'>
        <TopCards />
      </div>
      <div className='col-span-12 lg:col-span-8'>
        <WelcomeBanner />
      </div>
      <div className='col-span-12 lg:col-span-4'>
        <QuickAccess />
      </div>
      <div className='col-span-12 lg:col-span-6'>
        <AgendaDay />
      </div>
      <div className='col-span-12 lg:col-span-6'>
        <TasksAttention />
      </div>
    </div>
  )
}

export default RoleDashboard
