/**
 * Auth Callback Route
 *
 * Handles the redirect from Supabase after authentication.
 * Exchanges the code for a session.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/queue'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to login with error if something went wrong
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
