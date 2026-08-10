// Agenda (Fase 2 · Etapa 2) — panel-managed calendar events, backed by the
// calendar_events table (migration 0019). RLS: any staff role reads + writes.
// v1 is a generic event model (title + start/end + colour), like the sample
// design; the turno model (patient/professional/sucursal/status) layers on later.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

// The 5 swatches from the sample design. `key` is stable; `hex` is what we store.
export const EVENT_COLORS = [
  { key: 'primary', hex: '#5d87ff' },
  { key: 'green', hex: '#13deb9' },
  { key: 'red', hex: '#fa896b' },
  { key: 'blue', hex: '#539bff' },
  { key: 'yellow', hex: '#ffae1f' },
] as const

export const DEFAULT_EVENT_COLOR = EVENT_COLORS[0].hex

// Shape react-big-calendar consumes directly (start/end are Date objects).
export type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  color: string
}

type Row = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  all_day: boolean
  color: string
}

function rowToEvent(r: Row): CalendarEvent {
  return {
    id: r.id,
    title: r.title,
    start: new Date(r.starts_at),
    end: new Date(r.ends_at),
    allDay: r.all_day,
    color: r.color,
  }
}

export async function fetchCalendarEvents(): Promise<{
  data: CalendarEvent[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select('id, title, starts_at, ends_at, all_day, color')
    .order('starts_at', { ascending: true })
  if (error) return { data: [], error: error.message }
  return { data: (data as Row[]).map(rowToEvent), error: null }
}

export type CalendarEventInput = {
  title: string
  start: Date
  end: Date
  allDay: boolean
  color: string
}

/** Insert a new event. Returns the created event or an error string. */
export async function createCalendarEvent(
  input: CalendarEventInput,
): Promise<{ data: CalendarEvent | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: null, error: null }
  // Best-effort attribution — never block creation on the session lookup.
  const { data: userData } = await getSupabase().auth.getUser()
  const createdBy = userData?.user?.id ?? null
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .insert({
      title: input.title,
      starts_at: input.start.toISOString(),
      ends_at: input.end.toISOString(),
      all_day: input.allDay,
      color: input.color,
      created_by: createdBy,
    })
    .select('id, title, starts_at, ends_at, all_day, color')
    .single()
  if (error) return { data: null, error: error.message }
  return { data: rowToEvent(data as Row), error: null }
}

/** Update an existing event. Returns an error string on failure. */
export async function updateCalendarEvent(
  id: string,
  input: CalendarEventInput,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('calendar_events')
    .update({
      title: input.title,
      starts_at: input.start.toISOString(),
      ends_at: input.end.toISOString(),
      all_day: input.allDay,
      color: input.color,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  return error ? error.message : null
}

/** Delete an event. Returns an error string on failure. */
export async function deleteCalendarEvent(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('calendar_events').delete().eq('id', id)
  return error ? error.message : null
}
