/**
 * Customer Pickup API Route
 *
 * POST /api/customer/pickup - Schedule a pickup
 * GET /api/customer/pickup - List customer's pickups
 *
 * Requires customer authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import { requireCustomerAuth } from '@/lib/customer-auth'
import type {
  CreatePickupRequest,
  PickupResponse,
  PickupRequest,
} from '@/types/customer'

interface PickupListResponse {
  success: boolean
  pickups?: PickupRequest[]
  error?: string
}

/**
 * GET - List customer's pickups
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<PickupListResponse>> {
  // Require authentication
  const { customer, error } = await requireCustomerAuth(request)
  if (error) return error as NextResponse<PickupListResponse>

  try {
    const supabase = getSupabaseClient()

    const { data: pickups, error: dbError } = await supabase
      .from('pickup_requests')
      .select('*')
      .eq('customer_id', customer!.id)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('[Pickup] List error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch pickups' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      pickups: (pickups || []) as PickupRequest[],
    })
  } catch (error) {
    console.error('[Pickup] Error:', error)
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
 * POST - Schedule a pickup
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<PickupResponse>> {
  // Require authentication
  const { customer, error } = await requireCustomerAuth(request)
  if (error) return error as NextResponse<PickupResponse>

  try {
    const body: CreatePickupRequest = await request.json()

    // Validate required fields
    if (!body.quote_id) {
      return NextResponse.json(
        { success: false, error: 'Quote ID is required' },
        { status: 400 }
      )
    }

    if (!body.address) {
      return NextResponse.json(
        { success: false, error: 'Address is required' },
        { status: 400 }
      )
    }

    if (!body.address.street || !body.address.city || !body.address.emirate) {
      return NextResponse.json(
        { success: false, error: 'Street, city, and emirate are required' },
        { status: 400 }
      )
    }

    if (!body.preferred_date) {
      return NextResponse.json(
        { success: false, error: 'Preferred date is required' },
        { status: 400 }
      )
    }

    if (!body.preferred_time_slot) {
      return NextResponse.json(
        { success: false, error: 'Preferred time slot is required' },
        { status: 400 }
      )
    }

    // Validate date is in the future
    const preferredDate = new Date(body.preferred_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (preferredDate < today) {
      return NextResponse.json(
        { success: false, error: 'Pickup date must be in the future' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Verify the quote belongs to this customer and is in the right status
    const { data: quote, error: quoteError } = await supabase
      .from('quote_requests')
      .select('id, status')
      .eq('id', body.quote_id)
      .eq('customer_id', customer!.id)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      )
    }

    // Quote must be paid before scheduling pickup
    if (quote.status !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'Quote must be paid before scheduling pickup' },
        { status: 400 }
      )
    }

    // Check if a pickup already exists for this quote
    const { data: existingPickup } = await supabase
      .from('pickup_requests')
      .select('id')
      .eq('quote_request_id', body.quote_id)
      .single()

    if (existingPickup) {
      return NextResponse.json(
        { success: false, error: 'A pickup has already been scheduled for this quote' },
        { status: 400 }
      )
    }

    // Create pickup request
    const { data: pickup, error: createError } = await supabase
      .from('pickup_requests')
      .insert({
        quote_request_id: body.quote_id,
        customer_id: customer!.id,
        address: body.address,
        preferred_date: body.preferred_date,
        preferred_time_slot: body.preferred_time_slot,
        special_instructions: body.notes || null,
        status: 'scheduled',
      })
      .select()
      .single()

    if (createError || !pickup) {
      console.error('[Pickup] Create error:', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to schedule pickup' },
        { status: 500 }
      )
    }

    // Update quote status
    await supabase
      .from('quote_requests')
      .update({ status: 'pickup_scheduled' })
      .eq('id', body.quote_id)

    return NextResponse.json({
      success: true,
      pickup: pickup as PickupRequest,
    })
  } catch (error) {
    console.error('[Pickup] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
