/**
 * Queue Sync API Route
 *
 * POST /api/queue/sync
 *
 * Pulls new conversations with images from Zoko (last 7 days)
 * and adds them to the lead queue, skipping duplicates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  buildCustomerPhoneIndex,
  getCustomerMessages,
  isZokoConfigured,
  type ZokoCustomer,
  type ZokoMessage,
} from '@/lib/zoko/client'
import { getRecentOrders } from '@/lib/shopify/orders'
import { normalizePhone } from '@/lib/matching'
import type { QueueSyncResponse, QueueImage, ContextMessage } from '@/types/queue'

// How many days back to look for conversations
const LOOKBACK_DAYS = 7

// Group images within this time window (2 hours)
const IMAGE_GROUP_WINDOW_MS = 2 * 60 * 60 * 1000

interface ImageGroup {
  images: QueueImage[]
  contextMessages: ContextMessage[]
  firstImageAt: Date
}

/**
 * Group images by time window (2 hours)
 * Images sent close together are assumed to be of the same item
 */
function groupImagesByTimeWindow(messages: ZokoMessage[]): ImageGroup[] {
  // Filter to customer images only
  const imageMessages = messages
    .filter((m) => m.type === 'image' && m.direction === 'FROM_CUSTOMER')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  if (imageMessages.length === 0) return []

  const groups: ImageGroup[] = []
  let currentGroup: ImageGroup | null = null

  for (const msg of imageMessages) {
    const msgTime = new Date(msg.createdAt)

    if (!currentGroup) {
      // Start new group
      currentGroup = {
        images: [],
        contextMessages: [],
        firstImageAt: msgTime,
      }
    } else {
      // Check if this image is within the time window
      const timeDiff = msgTime.getTime() - currentGroup.firstImageAt.getTime()
      if (timeDiff > IMAGE_GROUP_WINDOW_MS) {
        // Save current group and start new one
        groups.push(currentGroup)
        currentGroup = {
          images: [],
          contextMessages: [],
          firstImageAt: msgTime,
        }
      }
    }

    // Add image to current group
    currentGroup.images.push({
      url: msg.mediaUrl || msg.fileUrl,
      messageId: msg.key.msgId,
      timestamp: msg.createdAt,
      caption: msg.fileCaption || undefined,
    })
  }

  // Don't forget the last group
  if (currentGroup && currentGroup.images.length > 0) {
    groups.push(currentGroup)
  }

  // Add context messages to each group
  for (const group of groups) {
    const groupStart = group.firstImageAt.getTime()
    const groupEnd = groupStart + IMAGE_GROUP_WINDOW_MS

    // Get messages around this time window
    const contextMsgs = messages
      .filter((m) => {
        if (m.type === 'image') return false // Skip images
        const msgTime = new Date(m.createdAt).getTime()
        // Get messages from 1 hour before to end of window
        return msgTime >= groupStart - 60 * 60 * 1000 && msgTime <= groupEnd
      })
      .slice(0, 10) // Limit context messages
      .map((m) => ({
        direction: m.direction,
        text: m.text || m.fileCaption || '',
        timestamp: m.createdAt,
      }))

    group.contextMessages = contextMsgs
  }

  return groups
}

export async function POST(request: NextRequest): Promise<NextResponse<QueueSyncResponse>> {
  try {
    const supabase = getSupabaseClient()
    // Check Zoko configuration
    if (!isZokoConfigured()) {
      return NextResponse.json(
        { success: false, added: 0, skipped: 0, error: 'Zoko API not configured' },
        { status: 500 }
      )
    }

    console.log('[QueueSync] Starting sync...')

    // Calculate date threshold (7 days ago)
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - LOOKBACK_DAYS)

    // Step 1: Get existing leads to avoid duplicates
    const { data: existingLeads } = await supabase
      .from('zoko_leads')
      .select('zoko_customer_id, first_image_at')

    const existingLeadKeys = new Set(
      (existingLeads || []).map((l) => `${l.zoko_customer_id}|${l.first_image_at}`)
    )
    console.log('[QueueSync] Found', existingLeadKeys.size, 'existing leads')

    // Step 2: Get recent Shopify orders (for deduplication)
    let orderedPhones = new Set<string>()
    try {
      const recentOrders = await getRecentOrders({ daysBack: LOOKBACK_DAYS, limit: 500 })
      orderedPhones = new Set(
        recentOrders
          .filter((o) => o.customer?.phone)
          .map((o) => normalizePhone(o.customer!.phone!) || '')
          .filter(Boolean)
      )
      console.log('[QueueSync] Found', orderedPhones.size, 'customers with recent orders')
    } catch (error) {
      console.error('[QueueSync] Error fetching Shopify orders:', error)
      // Continue without order deduplication
    }

    // Step 3: Get recent estimations (for deduplication)
    const { data: recentEstimations } = await supabase
      .from('estimations')
      .select('customer_phone')
      .gte('created_at', dateThreshold.toISOString())

    const estimatedPhones = new Set(
      (recentEstimations || [])
        .filter((e) => e.customer_phone)
        .map((e) => normalizePhone(e.customer_phone) || '')
        .filter(Boolean)
    )
    console.log('[QueueSync] Found', estimatedPhones.size, 'customers with recent estimations')

    // Step 4: Use phone index to get ALL customers, then filter by recent activity
    // This is much faster than paginating through oldest-first results
    console.log(`[QueueSync] Date threshold: ${dateThreshold.toISOString()}`)
    console.log('[QueueSync] Building customer index (this loads all customers)...')

    const customerIndex = await buildCustomerPhoneIndex(true) // Force refresh to get latest
    console.log(`[QueueSync] Index has ${customerIndex.size} customers`)

    // Filter to customers with recent activity
    const recentCustomers: ZokoCustomer[] = []
    for (const customer of customerIndex.values()) {
      if (!customer.lastIncomingMessageAt) continue

      const lastActivity = new Date(customer.lastIncomingMessageAt)
      if (lastActivity >= dateThreshold) {
        recentCustomers.push(customer)
      }
    }

    console.log(`[QueueSync] Found ${recentCustomers.length} customers with activity in last ${LOOKBACK_DAYS} days`)

    // Sort by most recent activity first
    recentCustomers.sort((a, b) => {
      const aTime = new Date(a.lastIncomingMessageAt!).getTime()
      const bTime = new Date(b.lastIncomingMessageAt!).getTime()
      return bTime - aTime // Most recent first
    })

    let added = 0
    let skipped = 0
    let customersWithImages = 0

    // Process each recent customer
    for (const customer of recentCustomers) {
      const customerPhone = normalizePhone(customer.channelId)

      // Skip if customer has recent order
      if (customerPhone && orderedPhones.has(customerPhone)) {
        console.log(`[QueueSync] Skipping ${customer.name} (${customer.channelId}) - has recent order`)
        skipped++
        continue
      }

      // Skip if customer has recent estimation
      if (customerPhone && estimatedPhones.has(customerPhone)) {
        console.log(`[QueueSync] Skipping ${customer.name} (${customer.channelId}) - has recent estimation`)
        skipped++
        continue
      }

      // Fetch messages for this customer
      let messages: ZokoMessage[]
      try {
        messages = await getCustomerMessages(customer.id)
      } catch (error) {
        console.error(`[QueueSync] Error fetching messages for ${customer.id}:`, error)
        continue
      }

      // Group images by time window
      const imageGroups = groupImagesByTimeWindow(messages)

      // Filter to groups with images in our time window
      const recentGroups = imageGroups.filter(
        (g) => g.firstImageAt >= dateThreshold
      )

      if (recentGroups.length === 0) {
        continue
      }

      customersWithImages++
      console.log(`[QueueSync] Found ${recentGroups.length} image group(s) for ${customer.name} (${customer.channelId})`)

      // Insert each group as a lead
      for (const group of recentGroups) {
        const leadKey = `${customer.id}|${group.firstImageAt.toISOString()}`

        // Skip if lead already exists
        if (existingLeadKeys.has(leadKey)) {
          skipped++
          continue
        }

        // Insert new lead
        const { error: insertError } = await supabase.from('zoko_leads').insert({
          zoko_customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.channelId,
          images: group.images,
          context_messages: group.contextMessages,
          first_image_at: group.firstImageAt.toISOString(),
          status: 'new',
        })

        if (insertError) {
          // Might be duplicate constraint violation
          if (insertError.code === '23505') {
            skipped++
          } else {
            console.error('[QueueSync] Insert error:', insertError)
          }
        } else {
          added++
          existingLeadKeys.add(leadKey) // Prevent duplicates in same sync
          console.log(`[QueueSync] Added lead for ${customer.name} with ${group.images.length} images`)
        }
      }
    }

    console.log(`[QueueSync] Stats: ${recentCustomers.length} recent customers, ${customersWithImages} with images`)

    console.log(`[QueueSync] Sync complete. Added: ${added}, Skipped: ${skipped}`)

    return NextResponse.json({
      success: true,
      added,
      skipped,
    })
  } catch (error) {
    console.error('[QueueSync] Error:', error)
    return NextResponse.json(
      {
        success: false,
        added: 0,
        skipped: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
