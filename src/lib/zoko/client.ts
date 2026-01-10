/**
 * Zoko CRM API Client
 *
 * Used to fetch historical conversation data for training
 * the AI recommendation system.
 */

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
