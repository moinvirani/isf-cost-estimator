/**
 * Customer Authentication Middleware
 *
 * Verifies JWT tokens from the customer mobile app.
 * Use in API routes that require customer authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Customer } from '@/types/customer'

// JWT secret (must match verify-otp)
const JWT_SECRET = new TextEncoder().encode(
  process.env.CUSTOMER_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'default-secret-change-me'
)

export interface CustomerAuthResult {
  customer: Customer | null
  error: NextResponse | null
}

/**
 * Require customer authentication for an API route
 *
 * Usage:
 * ```
 * const { customer, error } = await requireCustomerAuth(request)
 * if (error) return error
 * // customer is guaranteed to be non-null here
 * ```
 */
export async function requireCustomerAuth(
  request: NextRequest
): Promise<CustomerAuthResult> {
  // Get token from Authorization header
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      customer: null,
      error: NextResponse.json(
        { success: false, error: 'Missing authorization token' },
        { status: 401 }
      ),
    }
  }

  const token = authHeader.substring(7) // Remove "Bearer " prefix

  try {
    // Verify JWT
    const { payload } = await jwtVerify(token, JWT_SECRET)

    if (!payload.sub || payload.type !== 'customer') {
      return {
        customer: null,
        error: NextResponse.json(
          { success: false, error: 'Invalid token' },
          { status: 401 }
        ),
      }
    }

    // Fetch customer from database
    const supabase = getSupabaseClient()
    const { data: customer, error: dbError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', payload.sub)
      .single()

    if (dbError || !customer) {
      return {
        customer: null,
        error: NextResponse.json(
          { success: false, error: 'Customer not found' },
          { status: 401 }
        ),
      }
    }

    return { customer: customer as Customer, error: null }
  } catch (error) {
    console.error('[CustomerAuth] Token verification failed:', error)
    return {
      customer: null,
      error: NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      ),
    }
  }
}

/**
 * Get customer ID from token without full verification
 * Use for non-critical operations where speed matters
 */
export async function getCustomerIdFromToken(
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload.sub as string || null
  } catch {
    return null
  }
}
