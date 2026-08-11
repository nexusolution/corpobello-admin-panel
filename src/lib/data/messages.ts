// Shared conversation-transcript reader. The bot records every inbound/outbound
// WhatsApp message in `messages` (linked lead → conversations → messages). Both
// the patient 360° view and the Kanban lead detail render that transcript, so
// the content→text parser and the per-lead fetch live here as one source.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type ChatMessage = {
  id: string
  direction: 'in' | 'out'
  text: string
  createdAt: string
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

  const data: ChatMessage[] = ((msgRes.data as any[]) ?? []).map((m) => ({
    id: m.id,
    direction: m.direction,
    text: messageContentToText(m.direction, m.content),
    createdAt: m.created_at,
  }))
  return { data, error: null }
}
