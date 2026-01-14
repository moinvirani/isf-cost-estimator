/**
 * Supabase Auth Helpers
 *
 * Functions for authentication operations.
 * Used by login form, logout button, and protected routes.
 */

import { createClient } from './browser'

export interface AuthResult {
  success: boolean
  error?: string
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<AuthResult> {
  const supabase = createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Get the current user (client-side)
 */
export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback: (user: unknown) => void) {
  const supabase = createClient()

  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null)
  })
}
