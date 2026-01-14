/**
 * Supabase Exports
 */

// Lazy-loaded client (for API routes that don't need auth)
export { getSupabaseClient } from './client'

// Auth helpers (for client-side)
export { signIn, signOut, getCurrentUser, onAuthStateChange } from './auth'
export type { AuthResult } from './auth'

// Server-side auth (for API routes and Server Components)
export { createClient as createServerClient, getUser, isAuthenticated } from './server'

// Browser client (for client components)
export { createClient as createBrowserClient } from './browser'
