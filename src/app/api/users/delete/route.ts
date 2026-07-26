import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-only user deletion. Removes the Supabase Auth account; app_users
// cascades from it (0004), and referencing rows null out their link (0012).
// Requires SUPABASE_SERVICE_ROLE_KEY (server env). Admin-only; can't self-delete.

export const runtime = 'nodejs'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: Request) {
  if (!URL || !ANON || !SERVICE) {
    return NextResponse.json({ error: 'server-not-configured' }, { status: 500 })
  }

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

  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  }
  const id = body.id ?? ''
  if (!id) return NextResponse.json({ error: 'invalid-input' }, { status: 400 })
  if (id === caller.id) {
    return NextResponse.json({ error: 'cannot-delete-self' }, { status: 400 })
  }

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
