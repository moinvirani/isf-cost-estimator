/**
 * Shopify Orders Client
 *
 * Functions for fetching orders from Shopify Admin API.
 * Used for semi-automatic AI training by matching Zoko customers to their orders.
 */

import { shopifyAdminFetch } from './client'

// Types for order data
export interface ShopifyOrderLineItem {
  title: string
  quantity: number
  sku: string | null
  variant: {
    id: string
    title: string
    price: string
  } | null
}

export interface ShopifyOrder {
  id: string
  name: string // Order number like #1234
  createdAt: string
  totalPriceSet: {
    shopMoney: {
      amount: string
      currencyCode: string
    }
  }
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string | null
  } | null
  lineItems: {
    edges: Array<{
      node: ShopifyOrderLineItem
    }>
  }
}

interface OrdersQueryResponse {
  orders: {
    pageInfo?: {
      hasNextPage: boolean
      endCursor: string | null
    }
    edges: Array<{
      node: ShopifyOrder
    }>
  }
}

/**
 * GraphQL query to fetch orders by customer phone number
 */
const ORDERS_BY_PHONE_QUERY = `
  query OrdersByPhone($query: String!, $first: Int!) {
    orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            id
            firstName
            lastName
            phone
          }
          lineItems(first: 20) {
            edges {
              node {
                title
                quantity
                sku
                variant {
                  id
                  title
                  price
                }
              }
            }
          }
        }
      }
    }
  }
`

/**
 * Normalize phone number for Shopify search
 * Shopify stores phones in various formats, so we search with different variants
 */
function normalizePhoneForSearch(phone: string): string {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '')

  // If starts with +, keep it
  if (cleaned.startsWith('+')) {
    return cleaned
  }

  // If starts with 971 (UAE), add +
  if (cleaned.startsWith('971')) {
    return `+${cleaned}`
  }

  // Otherwise return as-is
  return cleaned
}

/**
 * Fetch orders by customer phone number
 * Returns orders for the customer, optionally filtered by date range
 *
 * @param phone - Customer phone number
 * @param options.limit - Max orders to return (default: 5)
 * @param options.afterDate - Only return orders created after this date
 * @param options.withinDays - Only return orders within X days after afterDate (default: 7)
 */
export async function getOrdersByPhone(
  phone: string,
  options: {
    limit?: number
    afterDate?: string  // ISO date string - only get orders after this date
    withinDays?: number // How many days after afterDate to look (default: 7)
  } = {}
): Promise<ShopifyOrder[]> {
  const { limit = 5, afterDate, withinDays = 7 } = options

  // Normalize phone number
  const normalizedPhone = normalizePhoneForSearch(phone)

  console.log('[Orders] Searching for phone:', phone, '-> normalized:', normalizedPhone)
  if (afterDate) {
    const startDate = new Date(afterDate)
    const endDate = new Date(afterDate)
    endDate.setDate(endDate.getDate() + withinDays)
    console.log('[Orders] Date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0])
  }

  // Build date filter for query if afterDate provided
  let dateFilter = ''
  if (afterDate) {
    const startDate = new Date(afterDate)
    const endDate = new Date(afterDate)
    endDate.setDate(endDate.getDate() + withinDays)

    // Shopify query format: created_at:>=2024-01-01 created_at:<=2024-01-08
    dateFilter = ` created_at:>=${startDate.toISOString().split('T')[0]} created_at:<=${endDate.toISOString().split('T')[0]}`
  }

  // Search Shopify orders by phone (try different formats)
  const searchVariants = [
    normalizedPhone,
    normalizedPhone.replace('+', ''), // Without +
    normalizedPhone.replace(/^(\+?971)/, '0'), // UAE local format
  ]

  const allOrders: ShopifyOrder[] = []

  for (const searchPhone of searchVariants) {
    try {
      const query = `phone:${searchPhone}${dateFilter}`
      const data = await shopifyAdminFetch<OrdersQueryResponse>(
        ORDERS_BY_PHONE_QUERY,
        { query, first: limit }
      )

      const orders = data.orders.edges.map((edge) => edge.node)
      allOrders.push(...orders)
    } catch (error) {
      console.error(`Error searching orders with phone ${searchPhone}:`, error)
    }
  }

  // Deduplicate orders by ID
  const uniqueOrders = Array.from(
    new Map(allOrders.map((o) => [o.id, o])).values()
  )

  // Sort by date (most recent first) and limit
  const result = uniqueOrders
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)

  console.log('[Orders] Found', result.length, 'orders for phone', phone)
  if (result.length > 0) {
    console.log('[Orders] Order dates:', result.map(o => o.createdAt.split('T')[0]).join(', '))
  }

  return result
}

/**
 * Extract service items from an order's line items
 * Filters to only items that appear to be repair services
 */
export function extractServicesFromOrder(order: ShopifyOrder): Array<{
  title: string
  quantity: number
  price: string
}> {
  return order.lineItems.edges.map((edge) => ({
    title: edge.node.title,
    quantity: edge.node.quantity,
    price: edge.node.variant?.price || '0',
  }))
}

/**
 * GraphQL query to fetch recent orders with pagination
 */
const RECENT_ORDERS_QUERY = `
  query RecentOrders($query: String!, $first: Int!, $after: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            id
            firstName
            lastName
            phone
          }
          lineItems(first: 20) {
            edges {
              node {
                title
                quantity
                sku
                variant {
                  id
                  title
                  price
                }
              }
            }
          }
        }
      }
    }
  }
`

/**
 * Fetch recent orders from Shopify
 * Paginates through results (Shopify max is 250 per request)
 *
 * @param options.daysBack - How many days back to look (default: 90)
 * @param options.limit - Max orders to return (default: 100)
 * @param options.tag - Filter by product tag (e.g., "Repair")
 */
export async function getRecentOrders(
  options: {
    daysBack?: number
    limit?: number
    tag?: string
  } = {}
): Promise<ShopifyOrder[]> {
  const { daysBack = 90, limit = 100, tag } = options

  // Shopify API max is 250 per request
  const PAGE_SIZE = Math.min(limit, 250)

  // Calculate date range
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  // Build query string
  let query = `created_at:>=${startDate.toISOString().split('T')[0]}`

  // Add tag filter if provided
  if (tag) {
    query += ` tag:${tag}`
  }

  console.log('[Orders] Fetching recent orders with query:', query, 'limit:', limit)

  try {
    const allOrders: ShopifyOrder[] = []
    let cursor: string | null = null
    let hasNextPage = true
    let pageCount = 0

    // Paginate through results
    while (hasNextPage && allOrders.length < limit) {
      pageCount++
      const remainingNeeded = limit - allOrders.length
      const fetchCount = Math.min(PAGE_SIZE, remainingNeeded)

      console.log(`[Orders] Fetching page ${pageCount}, requesting ${fetchCount} orders...`)

      const response: OrdersQueryResponse = await shopifyAdminFetch<OrdersQueryResponse>(
        RECENT_ORDERS_QUERY,
        { query, first: fetchCount, after: cursor }
      )

      const orders = response.orders.edges.map((edge) => edge.node)
      allOrders.push(...orders)

      // Update pagination state
      hasNextPage = response.orders.pageInfo?.hasNextPage ?? false
      cursor = response.orders.pageInfo?.endCursor ?? null

      console.log(`[Orders] Page ${pageCount}: got ${orders.length} orders, total: ${allOrders.length}`)

      // Safety: stop if no more results
      if (orders.length === 0) break
    }

    console.log('[Orders] Found', allOrders.length, 'orders in last', daysBack, 'days')

    // Filter to only orders with customer phone (needed for Zoko matching)
    const ordersWithPhone = allOrders.filter(o => o.customer?.phone)
    console.log('[Orders]', ordersWithPhone.length, 'orders have customer phone')

    return ordersWithPhone
  } catch (error) {
    console.error('[Orders] Error fetching recent orders:', error)
    throw error
  }
}
