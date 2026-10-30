import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * "Escribir por WhatsApp" link for Secretaría. Opens WhatsApp **Web** in the
 * browser (not the desktop/mobile app) with the patient's chat selected, using
 * whatever session is logged into that browser — i.e. the clinic's habitual
 * Corpo Bello WhatsApp Business number. There Secretaría replies freely, even
 * past the API 24h window, without depending on approved templates.
 *
 * We deliberately use `web.whatsapp.com/send` and NOT `wa.me`: `wa.me` hands off
 * to the OS WhatsApp handler, which on a Mac opens the desktop app instead of
 * the browser session (Andrés 2026-10-30, punto 6). Returns null when the phone
 * has too few digits to be a real number, so callers can hide the button.
 */
export function whatsappWebHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? `https://web.whatsapp.com/send?phone=${digits}` : null
}
