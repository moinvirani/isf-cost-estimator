/**
 * Customer Registration API Route
 *
 * POST /api/customer/auth/register
 *
 * Registers a new customer with email and password.
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

// Password requirements
const MIN_PASSWORD_LENGTH = 8

interface RegisterRequest {
  email: string
  password: string
  name?: string
}

interface RegisterResponse {
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
): Promise<NextResponse<RegisterResponse>> {
  try {
    const body: RegisterRequest = await request.json()

    // Validate inputs
    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password length
    if (body.password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }

    const email = body.email.toLowerCase().trim()
    const supabase = getSupabaseClient()

    // Check if email already exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .single()

    if (existingCustomer) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(body.password, salt)

    // Create new customer
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert({
        email,
        name: body.name?.trim() || null,
        password_hash: passwordHash,
        last_login_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError || !newCustomer) {
      console.error('[Register] Failed to create customer:', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create account' },
        { status: 500 }
      )
    }

    // Generate JWT token
    const token = await new SignJWT({
      sub: newCustomer.id,
      email: newCustomer.email,
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
        id: newCustomer.id,
        email: newCustomer.email,
        name: newCustomer.name,
      },
    })
  } catch (error) {
    console.error('[Register] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
