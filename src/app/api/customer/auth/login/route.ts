/**
 * Customer Login API Route
 *
 * POST /api/customer/auth/login
 *
 * Authenticates a customer with email and password.
 * Returns a JWT token for authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

// JWT secret (should be in env vars)
const JWT_SECRET = new TextEncoder().encode(
  process.env.CUSTOMER_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'default-secret-change-me'
)

// JWT expires after 30 days
const JWT_EXPIRY = '30d'

interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  success: boolean
  token?: string
  customer?: {
    id: string
    email: string
    name?: string
  }
  error?: string
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<LoginResponse>> {
  try {
    const body: LoginRequest = await request.json()

    // Validate inputs
    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const email = body.email.toLowerCase().trim()
    const supabase = getSupabaseClient()

    // Find customer by email
    const { data: customer, error: findError } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single()

    if (findError || !customer) {
      // Generic error message to prevent email enumeration
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if customer has a password set
    if (!customer.password_hash) {
      return NextResponse.json(
        { success: false, error: 'Please use phone verification to login' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(body.password, customer.password_hash)

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update last login
    await supabase
      .from('customers')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', customer.id)

    // Generate JWT token
    const token = await new SignJWT({
      sub: customer.id,
      email: customer.email,
      type: 'customer',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .sign(JWT_SECRET)

    return NextResponse.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
      },
    })
  } catch (error) {
    console.error('[Login] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
