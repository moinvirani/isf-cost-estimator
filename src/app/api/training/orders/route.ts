/**
 * GET /api/training/orders
 *
 * Looks up Shopify orders by customer phone number.
 * Used for semi-automatic training - shows what services the customer actually ordered.
 *
 * Query params:
 * - phone: Customer phone number (required)
 * - limit: Max orders to return (default: 5)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrdersByPhone, extractServicesFromOrder, isShopifyConfigured } from '@/lib/shopify'

interface OrderForTraining {
  id: string
  orderNumber: string
  createdAt: string
  totalAmount: string
  currency: string
  services: Array<{
    title: string
    quantity: number
    price: string
  }>
}

interface OrdersResponse {
  success: boolean
  orders?: OrderForTraining[]
  error?: string
}

export async function GET(request: NextRequest): Promise<NextResponse<OrdersResponse>> {
  try {
    // Check if Shopify is configured
    if (!isShopifyConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Shopify API is not configured',
      }, { status: 500 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const phone = searchParams.get('phone')
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    if (!phone) {
      return NextResponse.json({
        success: false,
        error: 'phone parameter is required',
      }, { status: 400 })
    }

    // Fetch orders from Shopify
    const shopifyOrders = await getOrdersByPhone(phone, limit)

    // Transform to training format
    const orders: OrderForTraining[] = shopifyOrders.map((order) => ({
      id: order.id,
      orderNumber: order.name,
      createdAt: order.createdAt,
      totalAmount: order.totalPriceSet.shopMoney.amount,
      currency: order.totalPriceSet.shopMoney.currencyCode,
      services: extractServicesFromOrder(order),
    }))

    return NextResponse.json({
      success: true,
      orders,
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch orders',
    }, { status: 500 })
  }
}
