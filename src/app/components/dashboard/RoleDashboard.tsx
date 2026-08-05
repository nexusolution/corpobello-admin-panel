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

// Neutral placeholder shown while the role resolves. Rendering a role-specific
// layout here would flash the wrong dashboard on re-login (e.g. the admin
// layout for a split second before a profesional's view settles).
function DashboardSkeleton() {
  return (
    <div className='grid grid-cols-12 gap-6 animate-pulse'>
      <div className='col-span-12 h-16 rounded-lg bg-muted/50 dark:bg-darkmuted/40' />
      <div className='col-span-12 h-24 rounded-lg bg-muted/50 dark:bg-darkmuted/40' />
      <div className='col-span-12 lg:col-span-8 h-64 rounded-lg bg-muted/50 dark:bg-darkmuted/40' />
      <div className='col-span-12 lg:col-span-4 h-64 rounded-lg bg-muted/50 dark:bg-darkmuted/40' />
    </div>
  )
}

export function RoleDashboard() {
  const { role, loading } = useCurrentUser()

  // Show a neutral skeleton until the role is known — never a role-specific
  // layout, so no dashboard flashes for the wrong role on login/re-login.
  if (loading) return <DashboardSkeleton />

  if (role === 'profesional') {
    // Clinical view only — no clinic-wide economic/admin banner (Andrés' rule:
    // the Profesional sees no información económica ni administrativa).
    return (
      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-12'>
          <DashboardGreeting />
        </div>
        <div className='col-span-12'>
          <AgendaDay />
        </div>
        <div className='col-span-12'>
          <TasksAttention />
        </div>
      </div>
    )
  }

  if (role === 'operador') {
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
        {/* Front-desk view: no facturación (income/charges hidden). */}
        <div className='col-span-12 lg:col-span-8'>
          <WelcomeBanner showFinancials={false} />
        </div>
        <div className='col-span-12 lg:col-span-4'>
          <QuickAccess />
        </div>
      </div>
    )
  }

  // admin (default)
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
