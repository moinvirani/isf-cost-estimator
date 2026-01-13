/**
 * Shopify Draft Orders
 *
 * Creates draft orders via Shopify Admin GraphQL API.
 * Returns invoice URL for customer checkout.
 */

import { shopifyAdminFetch } from './client'

// Input types
export interface DraftOrderLineItem {
  variantId: string
  quantity: number
}

export interface DraftOrderCustomer {
  name: string
  phone: string
  email?: string
}

export interface CreateDraftOrderInput {
  customer: DraftOrderCustomer
  lineItems: DraftOrderLineItem[]
  note?: string
}

// Response types
export interface DraftOrderResult {
  success: boolean
  draftOrderId?: string
  invoiceUrl?: string
  totalPrice?: string
  error?: string
}

// GraphQL mutation response type
interface DraftOrderCreateResponse {
  draftOrderCreate: {
    draftOrder: {
      id: string
      invoiceUrl: string
      totalPriceSet: {
        shopMoney: {
          amount: string
          currencyCode: string
        }
      }
    } | null
    userErrors: Array<{
      field: string[]
      message: string
    }>
  }
}

/**
 * Create a draft order in Shopify
 */
export async function createDraftOrder(
  input: CreateDraftOrderInput
): Promise<DraftOrderResult> {
  const mutation = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          invoiceUrl
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `

  // Build line items for GraphQL
  const lineItems = input.lineItems.map((item) => ({
    variantId: item.variantId.startsWith('gid://')
      ? item.variantId
      : `gid://shopify/ProductVariant/${item.variantId}`,
    quantity: item.quantity,
  }))

  // Build draft order input
  const draftOrderInput = {
    lineItems,
    // Customer info as billing address (Shopify will match or create customer)
    billingAddress: {
      firstName: input.customer.name.split(' ')[0] || input.customer.name,
      lastName: input.customer.name.split(' ').slice(1).join(' ') || '',
      phone: input.customer.phone,
    },
    // Also set email if provided
    ...(input.customer.email && { email: input.customer.email }),
    // Add note if provided
    ...(input.note && { note: input.note }),
    // Use default currency (AED)
    presentmentCurrencyCode: 'AED',
  }

  try {
    const response = await shopifyAdminFetch<DraftOrderCreateResponse>(mutation, {
      input: draftOrderInput,
    })

    // Check for user errors
    if (response.draftOrderCreate.userErrors.length > 0) {
      const errorMessages = response.draftOrderCreate.userErrors
        .map((e) => e.message)
        .join(', ')
      return {
        success: false,
        error: errorMessages,
      }
    }

    // Check if draft order was created
    if (!response.draftOrderCreate.draftOrder) {
      return {
        success: false,
        error: 'Failed to create draft order',
      }
    }

    const draftOrder = response.draftOrderCreate.draftOrder

    return {
      success: true,
      draftOrderId: draftOrder.id,
      invoiceUrl: draftOrder.invoiceUrl,
      totalPrice: draftOrder.totalPriceSet.shopMoney.amount,
    }
  } catch (error) {
    console.error('Draft order creation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
