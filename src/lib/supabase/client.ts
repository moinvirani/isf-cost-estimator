/**
 * Supabase Client
 *
 * This creates a connection to your Supabase project.
 * We use the environment variables from .env.local
 *
 * Usage:
 *   import { getSupabaseClient } from '@/lib/supabase/client'
 *   const supabase = getSupabaseClient()
 *   const { data, error } = await supabase.from('estimations').select()
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Cached client instance
let supabaseClient: SupabaseClient | null = null

/**
 * Get Supabase client (lazy-loaded to avoid build-time errors)
 * The client is cached after first creation
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL. Add it to your .env.local file.'
    )
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Add it to your .env.local file.'
    )
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseClient
}
