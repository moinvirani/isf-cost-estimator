/**
 * Customer Quotes API Route
 *
 * GET /api/customer/quotes - List customer's quotes
 * POST /api/customer/quotes - Submit new quote request
 *
 * Requires customer authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { fetchShopifyServices } from '@/lib/shopify/services'
import type {
  CreateQuoteRequest,
  QuoteResponse,
  QuoteListResponse,
  QuoteRequest,
  QuoteAIAnalysis,
  QuoteService,
} from '@/types/customer'

// Services that qualify for instant quotes (no staff review needed)
const INSTANT_SERVICES = [
  // Cleaning services
  'Shoe Shine',
  'Bag Cleaning',
  'Leather Conditioning',
  'Basic Polishing',
  'Dust Bag Cleaning',
  'Multi-Material Cleaning',
  'Sneaker Cleaning',
  'Suede Cleaning',
  'Shampoo Suede',
  // Basic repairs
  'Rubber Heel Replacement',
  'Heel Tips',
  'Minor Touch-ups',
  // Care treatments
  'Waterproofing',
  'Protection Treatment',
]

// Confidence threshold for instant quotes
const INSTANT_QUOTE_CONFIDENCE = 0.8

/**
 * GET - List customer's quotes
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<QuoteListResponse>> {
  // Require authentication
  const { customer, error } = await requireCustomerAuth(request)
  if (error) return error as NextResponse<QuoteListResponse>

  try {
    const supabase = getSupabaseClient()

    const { data: quotes, error: dbError } = await supabase
      .from('quote_requests')
      .select('*')
      .eq('customer_id', customer!.id)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('[Quotes] List error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch quotes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      quotes: (quotes || []) as QuoteRequest[],
    })
  } catch (error) {
    console.error('[Quotes] Error:', error)
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
 * POST - Submit new quote request
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<QuoteResponse>> {
  // Require authentication
  const { customer, error } = await requireCustomerAuth(request)
  if (error) return error as NextResponse<QuoteResponse>

  try {
    const body: CreateQuoteRequest = await request.json()

    // Validate images
    if (!body.images || body.images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one image is required' },
        { status: 400 }
      )
    }

    if (body.images.length > 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum 5 images allowed' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Create initial quote request
    const { data: quote, error: createError } = await supabase
      .from('quote_requests')
      .insert({
        customer_id: customer!.id,
        images: body.images,
        customer_notes: body.notes || null,
        status: 'pending_ai',
      })
      .select()
      .single()

    if (createError || !quote) {
      console.error('[Quotes] Create error:', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create quote request' },
        { status: 500 }
      )
    }

    // Call AI analysis (reuse existing analyze endpoint logic)
    let aiAnalysis: QuoteAIAnalysis | null = null
    let suggestedServices: string[] = []

    try {
      const analyzeResponse = await fetch(
        new URL('/api/analyze', request.url).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Use internal service call (no auth needed for internal)
            'X-Internal-Service': 'customer-app',
          },
          body: JSON.stringify({
            imageUrls: body.images,
            contextMessages: body.notes ? [body.notes] : [],
          }),
        }
      )

      const analyzeData = await analyzeResponse.json()

      if (analyzeData.success && analyzeData.analyses?.[0]) {
        const analysis = analyzeData.analyses[0]
        aiAnalysis = {
          category: analysis.category,
          sub_type: analysis.sub_type || analysis.subType,
          material: analysis.material,
          color: analysis.color,
          brand: analysis.brand,
          condition: analysis.condition,
          issues: analysis.issues || [],
          suggested_services: analysis.suggested_services || [],
          confidence: analysis.confidence,
        }
        suggestedServices = aiAnalysis.suggested_services
      }
    } catch (aiError) {
      console.error('[Quotes] AI analysis error:', aiError)
      // Continue without AI analysis - will need staff review
    }

    // Determine quote type and pricing
    const isInstantQuote =
      aiAnalysis &&
      aiAnalysis.confidence >= INSTANT_QUOTE_CONFIDENCE &&
      suggestedServices.length > 0 &&
      suggestedServices.every((s) =>
        INSTANT_SERVICES.some((is) => s.toLowerCase().includes(is.toLowerCase()))
      )

    // Get service prices from Shopify
    const services: QuoteService[] = []
    let priceMin = 0
    let priceMax = 0

    if (suggestedServices.length > 0) {
      try {
        const shopifyServices = await fetchShopifyServices()

        for (const serviceName of suggestedServices) {
          const matched = shopifyServices.find(
            (s) => s.title.toLowerCase().includes(serviceName.toLowerCase())
          )
          if (matched) {
            services.push({
              name: matched.title,
              price: matched.price,
              variant_id: matched.variant_id,
            })
            priceMin += matched.price
            priceMax += matched.price
          }
        }

        // For staff review quotes, add a range
        if (!isInstantQuote && priceMin > 0) {
          priceMax = Math.ceil(priceMin * 1.5) // 50% buffer for complex jobs
        }
      } catch (priceError) {
        console.error('[Quotes] Pricing error:', priceError)
      }
    }

    // Update quote with analysis results
    const updateData: Record<string, unknown> = {
      ai_analysis: aiAnalysis,
      ai_suggested_services: suggestedServices,
      status: isInstantQuote ? 'quoted' : 'pending_staff',
      quote_type: isInstantQuote ? 'instant' : 'staff_review',
      services: services,
      estimated_price_min: priceMin || null,
      estimated_price_max: priceMax || null,
    }

    // For instant quotes, set final price
    if (isInstantQuote) {
      updateData.final_price = priceMin
    }

    const { data: updatedQuote, error: updateError } = await supabase
      .from('quote_requests')
      .update(updateData)
      .eq('id', quote.id)
      .select()
      .single()

    if (updateError) {
      console.error('[Quotes] Update error:', updateError)
    }

    const finalQuote = (updatedQuote || quote) as QuoteRequest

    // Build response message
    let message: string | undefined
    if (finalQuote.quote_type === 'staff_review') {
      message =
        'Our team is reviewing your request. You\'ll receive a notification when your quote is ready.'
    }

    return NextResponse.json({
      success: true,
      quote: finalQuote,
      message,
    })
  } catch (error) {
    console.error('[Quotes] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
