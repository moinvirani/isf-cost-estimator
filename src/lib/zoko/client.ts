/**
 * Zoko CRM API Client
 *
 * Used to fetch historical conversation data for training
 * the AI recommendation system.
 */

import { normalizePhone } from '@/lib/matching'

const ZOKO_API_KEY = process.env.ZOKO_API_KEY
const BASE_URL = 'https://chat.zoko.io/v2'

export interface ZokoCustomer {
  id: string
  name: string
  channel: string
  channelId: string
  lastIncomingMessageAt: string | null
}

export interface ZokoMessage {
  key: {
    customerId: string
    platformTimestamp: string
    msgId: string
  }
  direction: 'FROM_CUSTOMER' | 'FROM_STORE'
  type: string // 'image', 'text', 'template', etc.
  text: string
  fileCaption: string
  mediaUrl: string
  fileUrl: string
  senderName: string
  zokoAgent: string
  createdAt: string
}

/**
 * Fetch from Zoko API
 */
async function fetchZoko<T>(endpoint: string): Promise<T> {
  if (!ZOKO_API_KEY) {
    throw new Error('ZOKO_API_KEY is not configured')
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'apikey': ZOKO_API_KEY,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Zoko API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Get customers with pagination
 */
export async function getCustomers(page = 1): Promise<{
  customers: ZokoCustomer[]
  totalPages: number
  totalCustomers: number
}> {
  return fetchZoko(`/customer?channel=whatsapp&page=${page}`)
}

/**
 * Get messages for a customer
 */
export async function getCustomerMessages(customerId: string): Promise<ZokoMessage[]> {
  return fetchZoko(`/customer/${customerId}/messages?channel=whatsapp`)
}

/**
 * Find conversations with images
 * Returns customer ID + image messages + surrounding context
 */
export async function findConversationsWithImages(
  startPage: number,
  maxConversations: number
): Promise<Array<{
  customerId: string
  customerName: string
  imageMessages: ZokoMessage[]
  allMessages: ZokoMessage[]
}>> {
  const results: Array<{
    customerId: string
    customerName: string
    imageMessages: ZokoMessage[]
    allMessages: ZokoMessage[]
  }> = []

  let page = startPage

  while (results.length < maxConversations) {
    const { customers, totalPages } = await getCustomers(page)

    for (const customer of customers) {
      if (!customer.lastIncomingMessageAt) continue

      const messages = await getCustomerMessages(customer.id)

      const imageMessages = messages.filter(
        (m) => m.type === 'image' && m.direction === 'FROM_CUSTOMER'
      )

      if (imageMessages.length > 0) {
        results.push({
          customerId: customer.id,
          customerName: customer.name,
          imageMessages,
          allMessages: messages,
        })

        if (results.length >= maxConversations) break
      }
    }

    page++
    if (page > totalPages) break
  }

  return results
}

export function isZokoConfigured(): boolean {
  return Boolean(ZOKO_API_KEY)
}

// ============================================
// Phone Index for fast customer lookups
// ============================================

// In-memory cache for phone → customer mapping
let phoneIndex: Map<string, ZokoCustomer> | null = null
let indexBuildTime: number | null = null
const INDEX_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Build phone → customer index by iterating all Zoko pages
 * Results are cached in memory for fast lookups
 */
export async function buildCustomerPhoneIndex(forceRefresh = false): Promise<Map<string, ZokoCustomer>> {
  // Return cached index if valid
  if (
    phoneIndex &&
    indexBuildTime &&
    !forceRefresh &&
    Date.now() - indexBuildTime < INDEX_TTL_MS
  ) {
    console.log('[Zoko] Using cached phone index with', phoneIndex.size, 'entries')
    return phoneIndex
  }

  console.log('[Zoko] Building phone index...')
  const startTime = Date.now()

  const newIndex = new Map<string, ZokoCustomer>()
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    try {
      const result = await getCustomers(page)
      totalPages = result.totalPages

      for (const customer of result.customers) {
        // channelId is the phone number for WhatsApp customers
        if (customer.channelId) {
          const normalizedPhone = normalizePhone(customer.channelId)
          if (normalizedPhone) {
            newIndex.set(normalizedPhone, customer)
          }
        }
      }

      // Log progress every 50 pages
      if (page % 50 === 0) {
        console.log(`[Zoko] Indexed page ${page}/${totalPages}, ${newIndex.size} customers so far`)
      }

      page++
    } catch (error) {
      console.error(`[Zoko] Error on page ${page}:`, error)
      page++
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[Zoko] Phone index built: ${newIndex.size} customers in ${elapsed}s`)

  // Cache the result
  phoneIndex = newIndex
  indexBuildTime = Date.now()

  return newIndex
}

/**
 * Get Zoko customer by phone number (uses cached index)
 */
export async function getCustomerByPhone(phone: string): Promise<ZokoCustomer | null> {
  const index = await buildCustomerPhoneIndex()
  const normalizedPhone = normalizePhone(phone)

  if (!normalizedPhone) return null

  // Try exact match first
  const exactMatch = index.get(normalizedPhone)
  if (exactMatch) return exactMatch

  // Try matching with different lengths (e.g., with/without country code)
  for (const [indexPhone, customer] of index) {
    if (indexPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(indexPhone)) {
      return customer
    }
  }

  return null
}

/**
 * Clear the phone index cache
 */
export function clearPhoneIndexCache(): void {
  phoneIndex = null
  indexBuildTime = null
  console.log('[Zoko] Phone index cache cleared')
}
