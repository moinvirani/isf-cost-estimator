/**
 * Draft Orders API Route
 *
 * POST /api/shopify/draft-orders
 *
 * Creates a Shopify draft order with customer info and line items.
 * Returns the draft order ID and invoice URL for checkout.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createDraftOrder } from '@/lib/shopify'

// Request body type
interface CreateDraftOrderRequest {
  customer: {
    name: string
    phone: string
    email?: string
  }
  lineItems: Array<{
    variantId: string
    quantity: number
  }>
  note?: string
}

// Response type
interface CreateDraftOrderResponse {
  success: boolean
  draftOrderId?: string
  invoiceUrl?: string
  totalPrice?: string
  error?: string
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateDraftOrderResponse>> {
  try {
    // Parse request body
    const body: CreateDraftOrderRequest = await request.json()

    // Validate required fields
    if (!body.customer?.name) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 }
      )
    }

    if (!body.customer?.phone) {
      return NextResponse.json(
        { success: false, error: 'Customer phone is required' },
        { status: 400 }
      )
    }

    if (!body.lineItems || body.lineItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one line item is required' },
        { status: 400 }
      )
    }

    // Validate line items
    for (const item of body.lineItems) {
      if (!item.variantId) {
        return NextResponse.json(
          { success: false, error: 'Each line item must have a variantId' },
          { status: 400 }
        )
      }
      if (!item.quantity || item.quantity < 1) {
        return NextResponse.json(
          { success: false, error: 'Each line item must have a positive quantity' },
          { status: 400 }
        )
      }
    }

    // Create draft order in Shopify
    const result = await createDraftOrder({
      customer: {
        name: body.customer.name,
        phone: body.customer.phone,
        email: body.customer.email,
      },
      lineItems: body.lineItems,
      note: body.note,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create draft order' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      draftOrderId: result.draftOrderId,
      invoiceUrl: result.invoiceUrl,
      totalPrice: result.totalPrice,
    })
  } catch (error) {
    console.error('Draft order API error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      { success: false, error: `Failed to create draft order: ${errorMessage}` },
      { status: 500 }
    )
  }
}
