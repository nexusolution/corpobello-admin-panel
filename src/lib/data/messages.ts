// Shared conversation-transcript reader. The bot records every inbound/outbound
// WhatsApp message in `messages` (linked lead → conversations → messages). Both
// the patient 360° view and the Kanban lead detail render that transcript, so
// the content→text parser and the per-lead fetch live here as one source.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

// Storage bucket for inbound patient photos (bot migration 0026). Private —
// images are shown via short-lived signed URLs, never public links.
const PATIENT_MEDIA_BUCKET = 'patient-media'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1h, long enough to view a transcript

export type ChatMessage = {
  id: string
  direction: 'in' | 'out'
  text: string
  createdAt: string
  // Signed URL for an attached photo (inbound patient media), when present.
  imageUrl?: string
}

// Turn a messages.content jsonb blob into display text. Outbound rows store the
// router effect object ({type:'send_text', body}); inbound rows store the raw
// Meta message ({type:'text', text:{body}} or an interactive reply). Media rows
// render as a short placeholder rather than the raw payload.
export function messageContentToText(
  direction: 'in' | 'out',
  content: unknown,
): string {
  const c = (content ?? {}) as Record<string, any>
  if (direction === 'out') {
    if (typeof c.body === 'string') return c.body
    const map: Record<string, string> = {
      send_image: '📷 [imagen]',
      send_buttons: '[botones]',
      send_list: '[lista de opciones]',
      send_more_photos: '📷 [pedido de más fotos]',
    }
    return map[c.type as string] ?? '[mensaje]'
  }
  if (typeof c?.text?.body === 'string') return c.text.body
  const ir = c?.interactive
  if (ir?.button_reply?.title) return ir.button_reply.title
  if (ir?.list_reply?.title) return ir.list_reply.title
  const map: Record<string, string> = {
    image: '📷 [imagen recibida]',
    audio: '🎤 [audio]',
    video: '🎥 [video]',
    document: '📄 [documento]',
  }
  return map[c?.type as string] ?? '[mensaje recibido]'
}

// Full bot transcript for one lead, oldest first. Returns [] (no error) when
// Supabase is unconfigured or the lead has no conversation yet.
export async function fetchLeadTranscript(
  leadId: string,
): Promise<{ data: ChatMessage[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const supabase = getSupabase()

  const convRes = await supabase
    .from('conversations')
    .select('id')
    .eq('lead_id', leadId)
  if (convRes.error) return { data: [], error: convRes.error.message }
  const convIds = ((convRes.data as { id: string }[]) ?? []).map((c) => c.id)
  if (convIds.length === 0) return { data: [], error: null }

  const msgRes = await supabase
    .from('messages')
    .select('id, direction, content, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true })
  if (msgRes.error) return { data: [], error: msgRes.error.message }

  const rows = (msgRes.data as any[]) ?? []
  const data: ChatMessage[] = rows.map((m) => ({
    id: m.id,
    direction: m.direction,
    text: messageContentToText(m.direction, m.content),
    createdAt: m.created_at,
  }))

  // Attach signed URLs for any stored patient photos (bot migration 0026).
  // Best-effort: if the media lookup or signing fails, the transcript still
  // renders (the message keeps its text placeholder).
  await attachMediaUrls(supabase, data)

  return { data, error: null }
}

// Resolve stored patient photos for the given messages and set `imageUrl` on the
// ones that have media. Mutates `messages` in place. Never throws.
async function attachMediaUrls(
  supabase: ReturnType<typeof getSupabase>,
  messages: ChatMessage[],
): Promise<void> {
  const ids = messages.map((m) => m.id)
  if (ids.length === 0) return
  try {
    const mediaRes = await supabase
      .from('media')
      .select('message_id, storage_path')
      .in('message_id', ids)
    const mediaRows = (mediaRes.data as { message_id: string; storage_path: string }[]) ?? []
    if (mediaRows.length === 0) return

    // One signed URL per distinct storage path.
    const paths = [...new Set(mediaRows.map((r) => r.storage_path))]
    const signedRes = await supabase.storage
      .from(PATIENT_MEDIA_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
    const urlByPath = new Map<string, string>()
    for (const s of signedRes.data ?? []) {
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl)
    }

    const urlByMessage = new Map<string, string>()
    for (const r of mediaRows) {
      const url = urlByPath.get(r.storage_path)
      if (url && !urlByMessage.has(r.message_id)) {
        urlByMessage.set(r.message_id, url)
      }
    }
    for (const m of messages) {
      const url = urlByMessage.get(m.id)
      if (url) m.imageUrl = url
    }
  } catch {
    // Non-fatal — leave the transcript text-only.
  }
}
