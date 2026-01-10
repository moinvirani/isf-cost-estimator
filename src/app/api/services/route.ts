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

export async function GET() {
  try {
    // Check if Shopify is configured
    if (!isShopifyConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Shopify is not configured. Please add SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN to your environment variables.',
        },
        { status: 500 }
      )
    }

    // Fetch services from Shopify
    const services = await fetchShopifyServices()

    return NextResponse.json({
      success: true,
      services,
      count: services.length,
    })
  } catch (error) {
    console.error('Error fetching services:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch services',
      },
      { status: 500 }
    )
  }
}
