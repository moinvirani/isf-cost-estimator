/**
 * GET /api/services
 *
 * Fetches all service products from Shopify.
 * Services are products tagged with "service" in Shopify.
 *
 * Response:
 * - success: boolean
 * - services: ShopifyService[] (on success)
 * - error: string (on failure)
 */

import { NextResponse } from 'next/server'
import { fetchShopifyServices, isShopifyConfigured } from '@/lib/shopify'

// CORS headers for mobile app access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function GET() {
  try {
    // Check if Shopify is configured
    if (!isShopifyConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Shopify is not configured. Please add SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN to your environment variables.',
        },
        { status: 500, headers: corsHeaders }
      )
    }

    // Fetch services from Shopify
    const services = await fetchShopifyServices()

    return NextResponse.json({
      success: true,
      services,
      count: services.length,
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error fetching services:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch services',
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
