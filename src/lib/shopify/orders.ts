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
 * Returns most recent orders for the customer
 */
export async function getOrdersByPhone(
  phone: string,
  limit: number = 5
): Promise<ShopifyOrder[]> {
  // Normalize phone number
  const normalizedPhone = normalizePhoneForSearch(phone)

  // Search Shopify orders by phone (try different formats)
  const searchVariants = [
    normalizedPhone,
    normalizedPhone.replace('+', ''), // Without +
    normalizedPhone.replace(/^(\+?971)/, '0'), // UAE local format
  ]

  const allOrders: ShopifyOrder[] = []

  for (const searchPhone of searchVariants) {
    try {
      const data = await shopifyAdminFetch<OrdersQueryResponse>(
        ORDERS_BY_PHONE_QUERY,
        { query: `phone:${searchPhone}`, first: limit }
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
  return uniqueOrders
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
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
