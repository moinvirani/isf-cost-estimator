/**
 * GET /api/training/zoko-images
 *
 * Fetches conversations with images from Zoko CRM.
 * Groups images by time window (images sent within 2 hours = same item).
 * Orders are loaded lazily via separate API call for better performance.
 *
 * Query params:
 * - page: Starting page (default: 1, higher = more recent)
 * - limit: Max item groups to return (default: 10)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCustomers, getCustomerMessages, isZokoConfigured } from '@/lib/zoko'
import type { ZokoConversationForTraining, ZokoImage, FetchZokoImagesResponse } from '@/types/training'

// Time window for grouping images (2 hours = same item, different angles)
const IMAGE_GROUP_WINDOW_MS = 2 * 60 * 60 * 1000

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

    // Fetch conversations with images
    // Process in batches for better performance
    while (allConversations.length < limit) {
      const { customers, totalPages: tp } = await getCustomers(currentPage)
      totalPages = tp

      // Filter to customers with incoming messages
      const activeCustomers = customers.filter(c => c.lastIncomingMessageAt)

      // Fetch messages for all customers in parallel (batch of 5 at a time)
      const batchSize = 5
      for (let i = 0; i < activeCustomers.length; i += batchSize) {
        const batch = activeCustomers.slice(i, i + batchSize)

        const messagesResults = await Promise.all(
          batch.map(async (customer) => {
            try {
              const messages = await getCustomerMessages(customer.id)
              return { customer, messages: Array.isArray(messages) ? messages : [] }
            } catch {
              return { customer, messages: [] }
            }
          })
        )

        // Process each customer's messages
        for (const { customer, messages } of messagesResults) {
          if (messages.length === 0) continue

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

          // Group images by time window (2 hours = same item)
          const imageGroups = groupImagesByItem(imageMessages)

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
              // Orders loaded lazily via separate API call
              hasOrders: false,
              matchingOrders: [],
              contextMessages,
            })

            if (allConversations.length >= limit) break
          }

          if (allConversations.length >= limit) break
        }

        if (allConversations.length >= limit) break
      }

      currentPage++
      if (currentPage > totalPages) break
    }

    // Sort by timestamp (newest first)
    allConversations.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    // Return only the requested limit
    const conversations = allConversations.slice(0, limit)

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
