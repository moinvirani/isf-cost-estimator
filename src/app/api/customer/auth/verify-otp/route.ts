/**
 * Verify OTP API Route
 *
 * POST /api/customer/auth/verify-otp
 *
 * Verifies the OTP code and returns a JWT token for authentication.
 * Creates a new customer record if first login.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import { normalizePhoneNumber, isValidPhoneNumber } from '@/lib/sms'
import type {
  VerifyOtpRequest,
  VerifyOtpResponse,
  Customer,
} from '@/types/customer'
import { SignJWT } from 'jose'

// JWT secret (should be in env vars)
const JWT_SECRET = new TextEncoder().encode(
  process.env.CUSTOMER_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'default-secret-change-me'
)

// JWT expires after 30 days
const JWT_EXPIRY = '30d'

// Max OTP verification attempts
const MAX_ATTEMPTS = 5

export async function POST(
  request: NextRequest
): Promise<NextResponse<VerifyOtpResponse>> {
  try {
    const body: VerifyOtpRequest = await request.json()

    // Validate inputs
    if (!body.phone || !body.otp) {
      return NextResponse.json(
        { success: false, error: 'Phone and OTP are required' },
        { status: 400 }
      )
    }

    const phone = normalizePhoneNumber(body.phone)

    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // OTP must be 6 digits
    if (!/^\d{6}$/.test(body.otp)) {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP format' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Find valid OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', body.otp)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (otpError || !otpRecord) {
      // Increment attempt counter for rate limiting
      await supabase
        .from('otp_codes')
        .update({ attempts: (otpRecord?.attempts || 0) + 1 })
        .eq('phone', phone)
        .eq('used', false)

      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 401 }
      )
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { success: false, error: 'Too many failed attempts. Request a new code.' },
        { status: 429 }
      )
    }

    // Mark OTP as used
    await supabase
      .from('otp_codes')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('id', otpRecord.id)

    // Find or create customer
    let customer: Customer | null = null
    let isNewCustomer = false

    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .single()

    if (existingCustomer) {
      customer = existingCustomer as Customer

      // Update last login
      await supabase
        .from('customers')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', customer.id)
    } else {
      // Create new customer
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
          phone,
          last_login_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (createError || !newCustomer) {
        console.error('[VerifyOTP] Failed to create customer:', createError)
        return NextResponse.json(
          { success: false, error: 'Failed to create account' },
          { status: 500 }
        )
      }

      customer = newCustomer as Customer
      isNewCustomer = true
    }

    // Generate JWT token
    const token = await new SignJWT({
      sub: customer.id,
      phone: customer.phone,
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
        phone: customer.phone,
        email: customer.email,
        name: customer.name,
      },
      isNewCustomer,
    })
  } catch (error) {
    console.error('[VerifyOTP] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
