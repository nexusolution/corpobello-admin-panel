// Tags & colors (A3). Backed by the `tags` + `tag_assignments` tables (Module A,
// migration 0004). RLS: everyone reads, only admins create/edit tags, operators
// assign/unassign. Tags are polymorphic — assignable to any entity via
// (entity_type, entity_id); the patient UI uses entity_type = 'patient'.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type TagScope =
  | 'patient'
  | 'treatment'
  | 'visit'
  | 'appointment'
  | 'lead_status'
  | 'general'

export type Tag = {
  id: string
  name: string
  color: string
  scope: TagScope
  description: string | null
  active: boolean
  archivedAt: string | null
}

// Preset palette for the color picker (stored as hex text on the tag).
export const TAG_COLORS: readonly string[] = [
  '#5d87ff', // primary
  '#13deb9', // success
  '#539bff', // info
  '#ffae1f', // warning
  '#fa896b', // error
  '#8754ec', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#64748b', // slate
]

type TagRow = {
  id: string
  name: string
  color: string
  scope: TagScope
  description: string | null
  active: boolean
  archived_at: string | null
}

function mapTag(r: TagRow): Tag {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    scope: r.scope,
    description: r.description,
    active: r.active,
    archivedAt: r.archived_at,
  }
}

export async function fetchTags(
  includeArchived = true,
): Promise<{ data: Tag[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  let query = getSupabase()
    .from('tags')
    .select('id, name, color, scope, description, active, archived_at')
    .order('name', { ascending: true })
  if (!includeArchived) query = query.eq('active', true)
  const { data, error } = await query
  if (error) return { data: [], error: error.message }
  return { data: (data as TagRow[]).map(mapTag), error: null }
}

export async function createTag(fields: {
  name: string
  color: string
  scope: TagScope
  description?: string
}): Promise<{ tag: Tag | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { tag: null, error: 'not-configured' }
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('tags')
    .insert({
      name: fields.name,
      color: fields.color,
      scope: fields.scope,
      description: fields.description || null,
      created_by: user?.id ?? null,
    })
    .select('id, name, color, scope, description, active, archived_at')
    .single()
  if (error || !data) return { tag: null, error: error?.message ?? 'insert-failed' }
  return { tag: mapTag(data as TagRow), error: null }
}

export async function updateTag(
  id: string,
  fields: { name?: string; color?: string; description?: string | null },
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('tags').update(fields).eq('id', id)
  return error ? error.message : null
}

/** Archive (soft-delete) or restore a tag. */
export async function setTagArchived(
  id: string,
  archived: boolean,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('tags')
    .update({ active: !archived, archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  return error ? error.message : null
}

// ---------- Assignments ----------

export async function fetchEntityTags(
  entityType: string,
  entityId: string,
): Promise<Tag[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await getSupabase()
    .from('tag_assignments')
    .select('tags:tag_id (id, name, color, scope, description, active, archived_at)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
  if (error || !data) return []
  return (data as any[])
    .map((r) => (Array.isArray(r.tags) ? r.tags[0] : r.tags))
    .filter(Boolean)
    .map((t: TagRow) => mapTag(t))
}

/** Assign multiple entities' tags in one query (for list views). */
export async function fetchEntityTagsBatch(
  entityType: string,
  entityIds: string[],
): Promise<Record<string, Tag[]>> {
  const out: Record<string, Tag[]> = {}
  if (!isSupabaseConfigured() || entityIds.length === 0) return out
  const { data, error } = await getSupabase()
    .from('tag_assignments')
    .select('entity_id, tags:tag_id (id, name, color, scope, description, active, archived_at)')
    .eq('entity_type', entityType)
    .in('entity_id', entityIds)
  if (error || !data) return out
  for (const r of data as any[]) {
    const tagRow = Array.isArray(r.tags) ? r.tags[0] : r.tags
    if (!tagRow) continue
    ;(out[r.entity_id] ??= []).push(mapTag(tagRow))
  }
  return out
}

export async function assignTag(
  tagId: string,
  entityType: string,
  entityId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase.from('tag_assignments').insert({
    tag_id: tagId,
    entity_type: entityType,
    entity_id: entityId,
    assigned_by: user?.id ?? null,
  })
  return error ? error.message : null
}

export async function unassignTag(
  tagId: string,
  entityType: string,
  entityId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('tag_assignments')
    .delete()
    .eq('tag_id', tagId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
  return error ? error.message : null
}
