import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-only user creation. Creating a Supabase Auth account (email+password =
// the login) requires the service_role key, which must NEVER reach the browser.
// This route runs on the server, verifies the caller is an admin, then uses the
// service role to create the auth user + the app_users row atomically.
//
// Requires SUPABASE_SERVICE_ROLE_KEY in the panel's server env (NOT public).

export const runtime = 'nodejs'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const ROLES = ['admin', 'operador', 'profesional'] as const

export async function POST(req: Request) {
  if (!URL || !ANON || !SERVICE) {
    return NextResponse.json(
      { error: 'server-not-configured' },
      { status: 500 },
    )
  }

  // 1. Authenticate the caller from their bearer token.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const callerClient = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const {
    data: { user: caller },
  } = await callerClient.auth.getUser()
  if (!caller) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 2. Authorize: only admins may create users.
  const admin = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: callerRow } = await admin
    .from('app_users')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (callerRow?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 3. Validate input.
  let body: {
    email?: string
    password?: string
    displayName?: string
    role?: string
    sucursal?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const displayName = (body.displayName ?? '').trim()
  const role = body.role ?? ''
  const sucursal = ['caballito', 'merlo', 'moreno'].includes(body.sucursal ?? '')
    ? (body.sucursal as string)
    : null
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 6 ||
    displayName.length === 0 ||
    !ROLES.includes(role as (typeof ROLES)[number])
  ) {
    return NextResponse.json({ error: 'invalid-input' }, { status: 400 })
  }

  // 4. Create the auth account (email pre-confirmed so they can log in now).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message ?? 'auth-create-failed' },
      { status: 400 },
    )
  }

  // 5. Insert the app_users row. Roll back the auth user if this fails, so we
  //    never leave an orphan login with no panel role.
  const { error: insertErr } = await admin.from('app_users').insert({
    id: created.user.id,
    email,
    display_name: displayName,
    role,
    sucursal,
  })
  if (insertErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: insertErr.message }, { status: 400 })
  }

  return NextResponse.json({ id: created.user.id, email, displayName, role })
}
