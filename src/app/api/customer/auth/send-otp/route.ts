/**
 * Send OTP API Route
 *
 * POST /api/customer/auth/send-otp
 *
 * Sends a 6-digit OTP code to the customer's phone number.
 * Rate limited to prevent abuse.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  sendOtpSms,
  generateOtp,
  normalizePhoneNumber,
  isValidPhoneNumber,
} from '@/lib/sms'
import type { SendOtpRequest, SendOtpResponse } from '@/types/customer'

// OTP expires after 5 minutes
const OTP_EXPIRY_MINUTES = 5

// Rate limit: max 3 OTPs per phone per hour
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MINUTES = 60

export async function POST(
  request: NextRequest
): Promise<NextResponse<SendOtpResponse>> {
  try {
    const body: SendOtpRequest = await request.json()

    // Validate phone number
    if (!body.phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
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

    const supabase = getSupabaseClient()

    // Check rate limit
    const rateLimitWindow = new Date()
    rateLimitWindow.setMinutes(rateLimitWindow.getMinutes() - RATE_LIMIT_WINDOW_MINUTES)

    const { count: recentOtpCount } = await supabase
      .from('otp_codes')
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', rateLimitWindow.toISOString())

    if (recentOtpCount && recentOtpCount >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many attempts. Please try again in an hour.',
        },
        { status: 429 }
      )
    }

    // Generate OTP
    const otp = generateOtp()
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES)

    // Store OTP in database
    const { error: insertError } = await supabase.from('otp_codes').insert({
      phone,
      code: otp,
      expires_at: expiresAt.toISOString(),
    })

    if (insertError) {
      console.error('[SendOTP] Database error:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to generate OTP' },
        { status: 500 }
      )
    }

    // Send OTP via SMS
    const smsResult = await sendOtpSms(phone, otp)

    if (!smsResult.success) {
      return NextResponse.json(
        { success: false, error: smsResult.error || 'Failed to send SMS' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
    })
  } catch (error) {
    console.error('[SendOTP] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
