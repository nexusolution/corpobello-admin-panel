import { NextResponse } from 'next/server'

// Returns the caller's public IP, read from the proxy headers Vercel sets.
// Used to record the signer's IP in the consent audit trail (Etapa 4). The
// client can't see its own public IP, so it asks this route at sign time.

export const runtime = 'nodejs'

export function GET(req: Request) {
  const fwd = req.headers.get('x-forwarded-for')
  const ip =
    (fwd ? fwd.split(',')[0]?.trim() : '') ||
    req.headers.get('x-real-ip') ||
    ''
  return NextResponse.json({ ip })
}
