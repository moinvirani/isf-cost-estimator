/**
 * Push Token Registration API Route
 *
 * POST /api/customer/push-token - Register a push notification token
 * DELETE /api/customer/push-token - Unregister a push token
 *
 * Requires customer authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import { requireCustomerAuth } from '@/lib/customer-auth'
import type {
  RegisterPushTokenRequest,
  PushTokenResponse,
} from '@/types/customer'

/**
 * POST - Register push notification token
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<PushTokenResponse>> {
  // Require authentication
  const { customer, error } = await requireCustomerAuth(request)
  if (error) return error as NextResponse<PushTokenResponse>

  try {
    const body: RegisterPushTokenRequest = await request.json()

    // Validate token
    if (!body.token) {
      return NextResponse.json(
        { success: false, error: 'Push token is required' },
        { status: 400 }
      )
    }

    // Validate platform
    if (!body.platform || !['ios', 'android'].includes(body.platform)) {
      return NextResponse.json(
        { success: false, error: 'Platform must be ios or android' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Check if token already exists for this customer
    const { data: existing } = await supabase
      .from('push_tokens')
      .select('id')
      .eq('customer_id', customer!.id)
      .eq('token', body.token)
      .single()

    if (existing) {
      // Token already registered, just return success
      return NextResponse.json({ success: true })
    }

    // Remove any old tokens for this customer on the same platform
    // (only keep one active token per platform per customer)
    await supabase
      .from('push_tokens')
      .delete()
      .eq('customer_id', customer!.id)
      .eq('platform', body.platform)

    // Insert new token
    const { error: insertError } = await supabase.from('push_tokens').insert({
      customer_id: customer!.id,
      token: body.token,
      platform: body.platform,
      device_name: body.device_name || null,
    })

    if (insertError) {
      console.error('[PushToken] Insert error:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to register push token' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PushToken] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Unregister push notification token
 */
export async function DELETE(
  request: NextRequest
): Promise<NextResponse<PushTokenResponse>> {
  // Require authentication
  const { customer, error } = await requireCustomerAuth(request)
  if (error) return error as NextResponse<PushTokenResponse>

  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Delete the token (only if it belongs to this customer)
    const { error: deleteError } = await supabase
      .from('push_tokens')
      .delete()
      .eq('customer_id', customer!.id)
      .eq('token', token)

    if (deleteError) {
      console.error('[PushToken] Delete error:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to unregister push token' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PushToken] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
