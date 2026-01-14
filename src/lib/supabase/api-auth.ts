/**
 * API Route Authentication Helper
 *
 * Validates that API requests are authenticated.
 * Use this in API routes that require authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Check if the request is authenticated
 * Returns the user if authenticated, or an error response if not
 */
export async function requireAuth(request: NextRequest): Promise<{
  user: { id: string; email?: string } | null
  error: NextResponse | null
}> {
  // Create Supabase client with cookies from request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // API routes don't need to set cookies
        },
      },
    }
  )

  // Get the authenticated user
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: 'Unauthorized - please log in' },
        { status: 401 }
      ),
    }
  }

  return { user, error: null }
}

/**
 * Simple auth check that returns boolean
 * Use when you only need to know if user is authenticated
 */
export async function isApiAuthenticated(request: NextRequest): Promise<boolean> {
  const { user } = await requireAuth(request)
  return user !== null
}
