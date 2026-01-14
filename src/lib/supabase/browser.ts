/**
 * Supabase Browser Client
 *
 * Creates a Supabase client for client-side operations (React components).
 * Uses cookies for session management.
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
