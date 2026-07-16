'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Browser Supabase client for the panel. The panel is a client-rendered app
// (the DashboardLayout gates on the session client-side), so this uses the
// standard browser client with localStorage session persistence — a direct
// upgrade from the previous mock `localStorage 'panel-auth'` flag.
//
// A stricter SSR/middleware auth (via @supabase/ssr + cookies) is a sensible
// future hardening, but would restructure the app's currently all-client
// auth flow; out of scope for this pass.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let cached: SupabaseClient | null = null

/** True when the Supabase env vars are present so auth can actually work. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

/**
 * Singleton browser client. Throws if the env vars are missing — callers that
 * run before login (the layout gate, the login form) check
 * isSupabaseConfigured() first and surface a clear "not configured" state
 * instead of a crash.
 */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }
  if (!cached) {
    cached = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return cached
}
