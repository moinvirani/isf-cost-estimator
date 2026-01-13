/**
 * GET /api/training/matched-conversations
 *
 * Shopify-first approach: Fetches recent Shopify orders, then finds
 * matching Zoko conversations with images for AI training.
 *
 * This ensures we only show conversations that have verified orders,
 * making the training data reliable.
 *
 * Query params:
 * - daysBack: How many days of orders to look back (default: 90)
 * - limit: Max matched conversations to return (default: 20)
 * - refresh: Set to 'true' to force refresh Zoko phone index cache
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getRecentOrders,
  extractServicesFromOrder,
  isShopifyConfigured,
  type ShopifyOrder,
} from '@/lib/shopify'
import {
  getCustomerByPhone,
  getCustomerMessages,
  buildCustomerPhoneIndex,
  isZokoConfigured,
  type ZokoCustomer,
} from '@/lib/zoko'
import { fuzzyNameMatch, calculateMatchConfidence } from '@/lib/matching'

// Types for the response
interface MatchedImage {
  url: string
  caption?: string
  messageId: string
  timestamp: string
}

interface MatchedConversation {
  // Shopify order info
  order: {
    id: string
    name: string
    createdAt: string
    totalPrice: string
    currency: string
    services: Array<{
      title: string
      quantity: number
      price: string
    }>
  }
  // Zoko customer info
  customer: {
    id: string
    name: string
    phone: string
  }
  // Matching confidence
  matchConfidence: 'high' | 'medium' | 'low'
  nameScore: number
  // Images from Zoko (sent before order)
  images: MatchedImage[]
  // Context messages
  contextMessages: Array<{
    direction: 'FROM_CUSTOMER' | 'FROM_STORE'
    text: string
    timestamp: string
  }>
}

interface MatchedConversationsResponse {
  success: boolean
  conversations?: MatchedConversation[]
  stats?: {
    ordersFound: number
    ordersWithPhone: number
    matchesFound: number
    indexSize: number
  }
  error?: string
}

/**
 * Find images sent within N days before the order date
 */
function findImagesBeforeOrder(
  messages: Array<{
    type: string
    direction: string
    mediaUrl: string
    fileCaption?: string
    key: { msgId: string }
    createdAt: string
  }>,
  orderDate: string,
  daysBeforeOrder = 7
): MatchedImage[] {
  const orderTime = new Date(orderDate).getTime()
  const windowStart = orderTime - daysBeforeOrder * 24 * 60 * 60 * 1000

  return messages
    .filter((m) => {
      if (m.type !== 'image' || m.direction !== 'FROM_CUSTOMER' || !m.mediaUrl) {
        return false
      }
      const msgTime = new Date(m.createdAt).getTime()
      // Image must be BEFORE order and within the window
      return msgTime < orderTime && msgTime >= windowStart
    })
    .map((m) => ({
      url: m.mediaUrl,
      caption: m.fileCaption || undefined,
      messageId: m.key.msgId,
      timestamp: m.createdAt,
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/**
 * Get context messages around images
 */
function getContextMessages(
  messages: Array<{
    type: string
    direction: string
    text?: string
    fileCaption?: string
    createdAt: string
  }>,
  imageTimestamp: string
): Array<{
  direction: 'FROM_CUSTOMER' | 'FROM_STORE'
  text: string
  timestamp: string
}> {
  const imgTime = new Date(imageTimestamp).getTime()

  // Find messages within 1 hour of the image
  const windowMs = 60 * 60 * 1000

  return messages
    .filter((m) => {
      if (m.type !== 'text' && m.type !== 'template') return false
      const msgTime = new Date(m.createdAt).getTime()
      return Math.abs(msgTime - imgTime) <= windowMs
    })
    .map((m) => ({
      direction: m.direction as 'FROM_CUSTOMER' | 'FROM_STORE',
      text: m.text || m.fileCaption || '',
      timestamp: m.createdAt,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, 10) // Max 10 context messages
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<MatchedConversationsResponse>> {
  try {
    // Check configs
    if (!isShopifyConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Shopify API is not configured',
      }, { status: 500 })
    }

    if (!isZokoConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Zoko API is not configured',
      }, { status: 500 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const daysBack = parseInt(searchParams.get('daysBack') || '90', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const forceRefresh = searchParams.get('refresh') === 'true'

    console.log('[Matched] Starting Shopify-first matching...')
    console.log('[Matched] Days back:', daysBack, 'Limit:', limit)

    // Step 1: Build/get Zoko phone index (cached)
    console.log('[Matched] Building/loading Zoko phone index...')
    const phoneIndex = await buildCustomerPhoneIndex(forceRefresh)
    console.log('[Matched] Phone index ready with', phoneIndex.size, 'customers')

    // Step 2: Fetch recent Shopify orders
    console.log('[Matched] Fetching recent Shopify orders...')
    const orders = await getRecentOrders({ daysBack, limit: 500 })
    console.log('[Matched] Found', orders.length, 'orders with customer phone')

    // Step 3: Match orders to Zoko customers (parallel processing for speed)
    const matchedConversations: MatchedConversation[] = []
    const BATCH_SIZE = 10 // Process 10 orders in parallel

    // Helper function to process a single order
    async function processOrder(order: ShopifyOrder): Promise<MatchedConversation | null> {
      const customerPhone = order.customer?.phone
      const customerFirstName = order.customer?.firstName
      const customerLastName = order.customer?.lastName

      if (!customerPhone) return null

      try {
        // Find Zoko customer by phone
        const zokoCustomer = await getCustomerByPhone(customerPhone)
        if (!zokoCustomer) return null

        // Calculate match confidence
        const { phoneMatch, nameScore, confidence } = calculateMatchConfidence(
          zokoCustomer.channelId,
          zokoCustomer.name,
          customerPhone,
          customerFirstName,
          customerLastName
        )

        if (!phoneMatch) {
          console.log(`[Matched] Skipping ${order.name}: phone doesn't match`)
          return null
        }

        // Get Zoko messages and find images before order
        const messages = await getCustomerMessages(zokoCustomer.id)
        if (!Array.isArray(messages)) return null

        const images = findImagesBeforeOrder(messages, order.createdAt, 7)
        if (images.length === 0) {
          console.log(`[Matched] Skipping ${order.name}: no images found before order date`)
          return null
        }

        // Get context messages around first image
        const contextMessages = getContextMessages(messages, images[0].timestamp)

        console.log(
          `[Matched] ✓ ${order.name} -> ${zokoCustomer.name} (${confidence}, ${nameScore}% name match, ${images.length} images)`
        )

        return {
          order: {
            id: order.id,
            name: order.name,
            createdAt: order.createdAt,
            totalPrice: order.totalPriceSet.shopMoney.amount,
            currency: order.totalPriceSet.shopMoney.currencyCode,
            services: extractServicesFromOrder(order),
          },
          customer: {
            id: zokoCustomer.id,
            name: zokoCustomer.name,
            phone: zokoCustomer.channelId,
          },
          matchConfidence: confidence === 'none' ? 'low' : confidence,
          nameScore,
          images,
          contextMessages,
        }
      } catch (orderError) {
        console.error(`[Matched] Error processing ${order.name}:`, orderError instanceof Error ? orderError.message : orderError)
        return null
      }
    }

    // Process orders in parallel batches
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      // Stop if we have enough matches
      if (matchedConversations.length >= limit) break

      const batch = orders.slice(i, i + BATCH_SIZE)
      console.log(`[Matched] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(orders.length / BATCH_SIZE)} (${batch.length} orders)`)

      // Process batch in parallel
      const batchResults = await Promise.allSettled(batch.map(processOrder))

      // Collect successful matches
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          matchedConversations.push(result.value)
        }
      }

      console.log(`[Matched] Found ${matchedConversations.length} matches so far`)
    }

    console.log(
      `[Matched] Complete: ${matchedConversations.length} matched conversations from ${orders.length} orders`
    )

    return NextResponse.json({
      success: true,
      conversations: matchedConversations,
      stats: {
        ordersFound: orders.length,
        ordersWithPhone: orders.length,
        matchesFound: matchedConversations.length,
        indexSize: phoneIndex.size,
      },
    })
  } catch (error) {
    console.error('[Matched] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch matched conversations',
    }, { status: 500 })
  }
}
