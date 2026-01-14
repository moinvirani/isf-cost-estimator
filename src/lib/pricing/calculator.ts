/**
 * Price Calculator
 *
 * Calculates prices for selected services.
 * Shopify prices are final - no modifiers applied.
 */

import type { ShopifyService } from '@/types/service'

interface SelectedServiceWithQuantity {
  service: ShopifyService
  quantity: number
}

interface PriceLineItem {
  serviceId: string      // Product ID (for reference)
  variantId: string      // Variant ID (for Shopify cart/orders)
  serviceName: string
  quantity: number
  basePrice: number
  lineTotal: number
}

interface PriceCalculationResult {
  lineItems: PriceLineItem[]
  subtotal: number
  grandTotal: number
  currency: string
}

/**
 * Calculate prices for all selected services
 * Shopify prices are used directly - no modifiers applied
 */
export function calculatePrices(
  selectedServices: SelectedServiceWithQuantity[]
): PriceCalculationResult {
  // Calculate line items
  const lineItems: PriceLineItem[] = selectedServices.map(({ service, quantity }) => {
    const basePrice = service.price
    const lineTotal = basePrice * quantity

    return {
      serviceId: service.id,
      variantId: service.variant_id,
      serviceName: service.title,
      quantity,
      basePrice,
      lineTotal,
    }
  })

  // Calculate total
  const grandTotal = selectedServices.reduce(
    (sum, { service, quantity }) => sum + service.price * quantity,
    0
  )

  return {
    lineItems,
    subtotal: grandTotal,
    grandTotal,
    currency: 'AED',
  }
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency = 'AED'): string {
  return `${currency} ${amount.toFixed(2)}`
}
