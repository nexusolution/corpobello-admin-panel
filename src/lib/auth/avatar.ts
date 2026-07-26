'use client'

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

// Downscale + square-crop an uploaded image to a small JPEG data URL, so the
// avatar stays tiny (~10-20KB) when stored in app_users.avatar_url.
export function fileToAvatarDataUrl(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('no-canvas'))
        return
      }
      // Cover: scale so the shorter side fills the square, center-crop the rest.
      const scale = Math.max(size / img.width, size / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('bad-image'))
    }
    img.src = url
  })
}

/** Persist the signed-in user's own avatar via the SECURITY DEFINER RPC. */
export async function setOwnAvatar(dataUrl: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().rpc('set_own_avatar', { p_url: dataUrl })
  return error ? error.message : null
}
