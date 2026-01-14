/**
 * Customer Quote Detail API Route
 *
 * GET /api/customer/quotes/[id] - Get quote details
 *
 * Requires customer authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import { requireCustomerAuth } from '@/lib/customer-auth'
import type { QuoteResponse, QuoteRequest } from '@/types/customer'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET - Get quote details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<QuoteResponse>> {
  // Require authentication
  const { customer, error } = await requireCustomerAuth(request)
  if (error) return error as NextResponse<QuoteResponse>

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Quote ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    const { data: quote, error: dbError } = await supabase
      .from('quote_requests')
      .select('*')
      .eq('id', id)
      .eq('customer_id', customer!.id) // Ensure customer owns this quote
      .single()

    if (dbError || !quote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      quote: quote as QuoteRequest,
    })
  } catch (error) {
    console.error('[Quote Detail] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
