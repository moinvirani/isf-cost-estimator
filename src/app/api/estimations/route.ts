/**
 * Estimations API Route
 *
 * GET /api/estimations - List all estimations
 * POST /api/estimations - Create new estimation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Type for estimation with items
interface EstimationWithItems {
  id: string
  created_at: string
  status: string
  customer_name: string | null
  customer_phone: string | null
  grand_total: number
  draft_order_id: string | null
  draft_order_url: string | null
  customer_message: string | null
  estimation_items: {
    id: string
    image_url: string | null
    category: string | null
    material: string | null
    item_subtotal: number
  }[]
}

/**
 * GET /api/estimations
 * List estimations with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Fetch estimations with item count
    const { data: estimations, error, count } = await supabase
      .from('estimations')
      .select(`
        id,
        created_at,
        status,
        customer_name,
        customer_phone,
        grand_total,
        draft_order_id,
        draft_order_url,
        estimation_items (
          id,
          image_url,
          category,
          material,
          item_subtotal
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching estimations:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      estimations: estimations as EstimationWithItems[],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch estimations:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch estimations' },
      { status: 500 }
    )
  }
}

// Request body type for creating estimation
interface CreateEstimationRequest {
  customer: {
    name: string
    phone: string
    email?: string
  }
  items: {
    imageUrl: string
    imagePath?: string
    category?: string
    subType?: string
    material?: string
    color?: string
    brand?: string
    condition?: string
    aiAnalysis?: object
    aiConfidence?: number
    services: {
      shopifyProductId?: string
      shopifyVariantId: string
      serviceName: string
      quantity: number
      basePrice: number
      finalPrice: number
      aiSuggested: boolean
    }[]
    subtotal: number
  }[]
  grandTotal: number
  draftOrderId: string
  draftOrderUrl: string
  customerMessage: string
}

/**
 * POST /api/estimations
 * Create new estimation with items and services
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateEstimationRequest = await request.json()

    // Create estimation
    const { data: estimation, error: estimationError } = await supabase
      .from('estimations')
      .insert({
        status: 'completed',
        customer_name: body.customer.name,
        customer_phone: body.customer.phone,
        grand_total: body.grandTotal,
        currency: 'AED',
        draft_order_id: body.draftOrderId,
        draft_order_url: body.draftOrderUrl,
        customer_message: body.customerMessage,
      })
      .select()
      .single()

    if (estimationError) {
      console.error('Error creating estimation:', estimationError)
      throw estimationError
    }

    // Create items
    for (const item of body.items) {
      const { data: createdItem, error: itemError } = await supabase
        .from('estimation_items')
        .insert({
          estimation_id: estimation.id,
          image_url: item.imageUrl,
          image_path: item.imagePath,
          category: item.category,
          sub_type: item.subType,
          material: item.material,
          color: item.color,
          brand: item.brand,
          condition: item.condition,
          ai_analysis: item.aiAnalysis,
          ai_confidence: item.aiConfidence,
          item_subtotal: item.subtotal,
        })
        .select()
        .single()

      if (itemError) {
        console.error('Error creating item:', itemError)
        throw itemError
      }

      // Create services for this item
      for (const service of item.services) {
        const { error: serviceError } = await supabase
          .from('item_services')
          .insert({
            item_id: createdItem.id,
            shopify_product_id: service.shopifyProductId,
            shopify_variant_id: service.shopifyVariantId,
            service_name: service.serviceName,
            quantity: service.quantity,
            base_price: service.basePrice,
            final_price: service.finalPrice,
            ai_suggested: service.aiSuggested,
          })

        if (serviceError) {
          console.error('Error creating service:', serviceError)
          throw serviceError
        }
      }
    }

    return NextResponse.json({
      success: true,
      estimationId: estimation.id,
    })
  } catch (error) {
    console.error('Failed to create estimation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create estimation' },
      { status: 500 }
    )
  }
}
