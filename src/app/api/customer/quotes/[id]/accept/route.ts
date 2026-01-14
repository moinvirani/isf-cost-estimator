/**
 * Accept Quote API Route
 *
 * POST /api/customer/quotes/[id]/accept - Accept quote and get payment URL
 *
 * Creates a Shopify draft order and returns the checkout URL.
 * Requires customer authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { createShopifyClient } from '@/lib/shopify/client'
import type { AcceptQuoteResponse, QuoteRequest } from '@/types/customer'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface ShopifyDraftOrder {
  id: number
  invoice_url: string
  admin_graphql_api_id: string
}

interface ShopifyDraftOrderResponse {
  draft_order: ShopifyDraftOrder
}

/**
 * POST - Accept quote and create Shopify draft order
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<AcceptQuoteResponse>> {
  // Require authentication
  const { customer, error } = await requireCustomerAuth(request)
  if (error) return error as NextResponse<AcceptQuoteResponse>

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Quote ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Fetch quote
    const { data: quote, error: fetchError } = await supabase
      .from('quote_requests')
      .select('*')
      .eq('id', id)
      .eq('customer_id', customer!.id)
      .single()

    if (fetchError || !quote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      )
    }

    const typedQuote = quote as QuoteRequest

    // Validate quote is in a state that can be accepted
    if (typedQuote.status !== 'quoted') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot accept quote with status: ${typedQuote.status}`,
        },
        { status: 400 }
      )
    }

    // Validate quote has a final price
    const finalPrice = typedQuote.final_price || typedQuote.estimated_price_min
    if (!finalPrice || finalPrice <= 0) {
      return NextResponse.json(
        { success: false, error: 'Quote has no valid price' },
        { status: 400 }
      )
    }

    // Validate services exist
    if (!typedQuote.services || typedQuote.services.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Quote has no services' },
        { status: 400 }
      )
    }

    // Create Shopify draft order
    const shopify = createShopifyClient()

    // Build line items from services
    const lineItems = typedQuote.services.map((service) => ({
      variant_id: service.variant_id,
      quantity: 1,
      price: service.price.toFixed(2),
    }))

    // Create draft order
    const draftOrderResponse = await shopify.post<ShopifyDraftOrderResponse>('draft_orders.json', {
      draft_order: {
        line_items: lineItems,
        customer: customer!.shopify_customer_id
          ? { id: customer!.shopify_customer_id }
          : undefined,
        email: customer!.email || undefined,
        phone: customer!.phone,
        note: `Quote Request #${typedQuote.id}`,
        tags: ['customer-app', `quote-${typedQuote.id}`],
        use_customer_default_address: true,
      },
    })

    if (!draftOrderResponse.draft_order) {
      console.error('[Accept Quote] Shopify error:', draftOrderResponse)
      return NextResponse.json(
        { success: false, error: 'Failed to create order' },
        { status: 500 }
      )
    }

    const draftOrder = draftOrderResponse.draft_order
    const checkoutUrl = draftOrder.invoice_url

    // Update quote status
    await supabase
      .from('quote_requests')
      .update({
        status: 'accepted',
        draft_order_id: draftOrder.id.toString(),
        draft_order_url: draftOrder.admin_graphql_api_id || null,
        payment_url: checkoutUrl,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      payment_url: checkoutUrl,
      draft_order_id: draftOrder.id.toString(),
    })
  } catch (error) {
    console.error('[Accept Quote] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
