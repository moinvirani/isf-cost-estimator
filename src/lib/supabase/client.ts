/**
 * Supabase Client
 *
 * This creates a connection to your Supabase project.
 * We use the environment variables from .env.local
 *
 * Usage:
 *   import { supabase } from '@/lib/supabase/client'
 *   const { data, error } = await supabase.from('estimations').select()
 */

import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check that we have the required environment variables
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

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
