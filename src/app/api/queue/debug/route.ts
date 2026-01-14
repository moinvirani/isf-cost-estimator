/**
 * Queue Debug API Route
 *
 * GET /api/queue/debug?phone=+919987541000
 *
 * Debug endpoint to check why a specific customer isn't being picked up.
 *
 * SECURITY: This endpoint is only available in development mode.
 * It exposes customer PII and should never be accessible in production.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getCustomerByPhone,
  getCustomerMessages,
  isZokoConfigured,
} from '@/lib/zoko/client'

export async function GET(request: NextRequest) {
  // SECURITY: Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoint is not available in production' },
      { status: 404 }
    )
  }

  const phone = request.nextUrl.searchParams.get('phone')

  if (!phone) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
  }

  if (!isZokoConfigured()) {
    return NextResponse.json({ error: 'Zoko not configured' }, { status: 500 })
  }

  try {
    // Find customer by phone
    const customer = await getCustomerByPhone(phone)

    if (!customer) {
      return NextResponse.json({
        found: false,
        message: 'Customer not found in Zoko by phone number',
        searchedPhone: phone,
      })
    }

    // Get their messages
    const messages = await getCustomerMessages(customer.id)

    // Analyze message types
    const messageTypes = messages.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Find image messages
    const imageMessages = messages.filter(m =>
      m.type === 'image' ||
      m.mediaUrl ||
      m.fileUrl
    )

    // Find FROM_CUSTOMER images
    const customerImages = imageMessages.filter(m => m.direction === 'FROM_CUSTOMER')

    // Get sample image message to see structure
    const sampleImageMessage = imageMessages[0] || null

    // Calculate 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Recent customer images
    const recentCustomerImages = customerImages.filter(m =>
      new Date(m.createdAt) >= sevenDaysAgo
    )

    return NextResponse.json({
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.channelId,
        lastIncomingMessageAt: customer.lastIncomingMessageAt,
      },
      totalMessages: messages.length,
      messageTypes,
      imageMessages: {
        total: imageMessages.length,
        fromCustomer: customerImages.length,
        recentFromCustomer: recentCustomerImages.length,
      },
      sampleImageMessage,
      recentImages: recentCustomerImages.slice(0, 5).map(m => ({
        type: m.type,
        direction: m.direction,
        mediaUrl: m.mediaUrl,
        fileUrl: m.fileUrl,
        createdAt: m.createdAt,
        caption: m.fileCaption,
      })),
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
