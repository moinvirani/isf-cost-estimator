/**
 * GET /api/training/zoko-images
 *
 * Fetches conversations with images from Zoko CRM.
 * Used for building training data for AI recommendations.
 *
 * Query params:
 * - page: Starting page (default: 1, higher = more recent)
 * - limit: Max conversations to return (default: 10)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCustomers, getCustomerMessages, isZokoConfigured } from '@/lib/zoko'
import type { ZokoConversationForTraining, FetchZokoImagesResponse } from '@/types/training'

export async function GET(request: NextRequest): Promise<NextResponse<FetchZokoImagesResponse>> {
  try {
    // Check if Zoko is configured
    if (!isZokoConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Zoko API is not configured. Add ZOKO_API_KEY to .env.local',
      }, { status: 500 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const startPage = parseInt(searchParams.get('page') || '200', 10) // Start from middle (recent-ish)
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    const conversations: ZokoConversationForTraining[] = []
    let currentPage = startPage
    let totalPages = 0

    // Fetch until we have enough conversations with images
    while (conversations.length < limit) {
      const { customers, totalPages: tp } = await getCustomers(currentPage)
      totalPages = tp

      for (const customer of customers) {
        // Skip customers without incoming messages
        if (!customer.lastIncomingMessageAt) continue

        // Get messages for this customer
        const messages = await getCustomerMessages(customer.id)

        if (!Array.isArray(messages)) continue

        // Find image messages from customer
        const imageMessages = messages.filter(
          (m) => m.type === 'image' && m.direction === 'FROM_CUSTOMER' && m.mediaUrl
        )

        for (const imgMsg of imageMessages) {
          // Get context messages (5 before and after)
          const msgIndex = messages.findIndex(m => m.key.msgId === imgMsg.key.msgId)
          const contextStart = Math.max(0, msgIndex - 5)
          const contextEnd = Math.min(messages.length, msgIndex + 6)
          const contextMessages = messages
            .slice(contextStart, contextEnd)
            .filter(m => m.type === 'text' || m.type === 'template')
            .map(m => ({
              direction: m.direction,
              text: m.text || m.fileCaption || '',
              timestamp: m.createdAt,
            }))

          conversations.push({
            customerId: customer.id,
            customerName: customer.name,
            imageUrl: imgMsg.mediaUrl,
            imageCaption: imgMsg.fileCaption || undefined,
            messageId: imgMsg.key.msgId,
            timestamp: imgMsg.createdAt,
            contextMessages,
          })

          if (conversations.length >= limit) break
        }

        if (conversations.length >= limit) break
      }

      currentPage++
      if (currentPage > totalPages) break
    }

    return NextResponse.json({
      success: true,
      conversations,
      hasMore: currentPage <= totalPages,
      nextPage: currentPage,
    })
  } catch (error) {
    console.error('Error fetching Zoko images:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Zoko images',
    }, { status: 500 })
  }
}
