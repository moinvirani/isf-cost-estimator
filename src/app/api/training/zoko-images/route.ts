/**
 * GET /api/training/zoko-images
 *
 * Fetches conversations with images from Zoko CRM.
 * Groups images sent within 15 minutes as the same item (different angles).
 * Prioritizes customers who have Shopify orders.
 *
 * Query params:
 * - page: Starting page (default: 1, higher = more recent)
 * - limit: Max item groups to return (default: 10)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCustomers, getCustomerMessages, isZokoConfigured } from '@/lib/zoko'
import { getOrdersByPhone, isShopifyConfigured } from '@/lib/shopify'
import type { ZokoConversationForTraining, ZokoImage, FetchZokoImagesResponse } from '@/types/training'

// Time window to group images (15 minutes in milliseconds)
const IMAGE_GROUP_WINDOW_MS = 15 * 60 * 1000

/**
 * Group consecutive images sent within the time window
 * Returns array of image groups, each group is one "item" with multiple angles
 */
function groupImagesByItem(
  imageMessages: Array<{
    mediaUrl: string
    fileCaption?: string
    msgId: string
    createdAt: string
  }>
): ZokoImage[][] {
  if (imageMessages.length === 0) return []

  // Sort by timestamp
  const sorted = [...imageMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const groups: ZokoImage[][] = []
  let currentGroup: ZokoImage[] = []

  for (const img of sorted) {
    const imgTime = new Date(img.createdAt).getTime()

    if (currentGroup.length === 0) {
      // Start new group
      currentGroup.push({
        url: img.mediaUrl,
        caption: img.fileCaption || undefined,
        messageId: img.msgId,
        timestamp: img.createdAt,
      })
    } else {
      // Check if within time window of last image in group
      const lastImg = currentGroup[currentGroup.length - 1]
      const lastTime = new Date(lastImg.timestamp).getTime()

      if (imgTime - lastTime <= IMAGE_GROUP_WINDOW_MS) {
        // Same item, add to current group
        currentGroup.push({
          url: img.mediaUrl,
          caption: img.fileCaption || undefined,
          messageId: img.msgId,
          timestamp: img.createdAt,
        })
      } else {
        // New item, save current group and start new one
        groups.push(currentGroup)
        currentGroup = [{
          url: img.mediaUrl,
          caption: img.fileCaption || undefined,
          messageId: img.msgId,
          timestamp: img.createdAt,
        }]
      }
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

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
    const startPage = parseInt(searchParams.get('page') || '200', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    const allConversations: ZokoConversationForTraining[] = []
    let currentPage = startPage
    let totalPages = 0

    // Fetch more than needed so we can prioritize those with orders
    const fetchLimit = limit * 3

    // Fetch conversations with images
    while (allConversations.length < fetchLimit) {
      const { customers, totalPages: tp } = await getCustomers(currentPage)
      totalPages = tp

      for (const customer of customers) {
        // Skip customers without incoming messages
        if (!customer.lastIncomingMessageAt) continue

        // Get messages for this customer
        const messages = await getCustomerMessages(customer.id)

        if (!Array.isArray(messages)) continue

        // Find image messages from customer
        const imageMessages = messages
          .filter((m) => m.type === 'image' && m.direction === 'FROM_CUSTOMER' && m.mediaUrl)
          .map((m) => ({
            mediaUrl: m.mediaUrl,
            fileCaption: m.fileCaption,
            msgId: m.key.msgId,
            createdAt: m.createdAt,
          }))

        if (imageMessages.length === 0) continue

        // Group images by item (different angles within 15 min window)
        const imageGroups = groupImagesByItem(imageMessages)

        // Check if customer has Shopify orders
        let hasOrders = false
        if (isShopifyConfigured() && customer.channelId) {
          try {
            const orders = await getOrdersByPhone(customer.channelId, 1)
            hasOrders = orders.length > 0
          } catch {
            // Ignore order lookup errors
          }
        }

        // Create a conversation entry for each image group (each item)
        for (const imageGroup of imageGroups) {
          // Get context messages around the first image in the group
          const firstImgMsgId = imageGroup[0].messageId
          const msgIndex = messages.findIndex((m) => m.key.msgId === firstImgMsgId)
          const contextStart = Math.max(0, msgIndex - 5)
          const contextEnd = Math.min(messages.length, msgIndex + 6)
          const contextMessages = messages
            .slice(contextStart, contextEnd)
            .filter((m) => m.type === 'text' || m.type === 'template')
            .map((m) => ({
              direction: m.direction as 'FROM_CUSTOMER' | 'FROM_STORE',
              text: m.text || m.fileCaption || '',
              timestamp: m.createdAt,
            }))

          allConversations.push({
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.channelId,
            images: imageGroup,
            // Keep legacy fields for backwards compatibility
            imageUrl: imageGroup[0].url,
            imageCaption: imageGroup[0].caption,
            messageId: imageGroup[0].messageId,
            timestamp: imageGroup[0].timestamp,
            hasOrders,
            contextMessages,
          })

          if (allConversations.length >= fetchLimit) break
        }

        if (allConversations.length >= fetchLimit) break
      }

      currentPage++
      if (currentPage > totalPages) break
    }

    // Sort: customers with orders first, then by timestamp (newest first)
    allConversations.sort((a, b) => {
      // Prioritize those with orders
      if (a.hasOrders && !b.hasOrders) return -1
      if (!a.hasOrders && b.hasOrders) return 1
      // Then by timestamp (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    // Return only the requested limit
    const conversations = allConversations.slice(0, limit)

    return NextResponse.json({
      success: true,
      conversations,
      hasMore: currentPage <= totalPages || allConversations.length > limit,
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
