/**
 * Price Calculator
 *
 * Calculates prices for selected services, applying any modifiers
 * based on material, condition, or other factors.
 */

import type { ShopifyService, PriceModifier } from '@/types/service'
import type { MaterialType, ConditionRating } from '@/types/item'

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
  modifiers: PriceModifier[]
  lineTotal: number // After modifiers and quantity
}

interface PriceCalculationResult {
  lineItems: PriceLineItem[]
  subtotal: number
  modifiersTotal: number
  grandTotal: number
  currency: string
}

/**
 * Material-based price modifiers
 * Certain materials require special handling and cost more
 */
const MATERIAL_MODIFIERS: Record<MaterialType, PriceModifier | null> = {
  smooth_leather: null,
  suede: {
    id: 'suede-surcharge',
    name: 'Suede Material',
    type: 'percentage',
    value: 15,
    reason: 'Suede requires specialized cleaning products',
  },
  nubuck: {
    id: 'nubuck-surcharge',
    name: 'Nubuck Material',
    type: 'percentage',
    value: 15,
    reason: 'Nubuck requires specialized cleaning products',
  },
  patent: {
    id: 'patent-surcharge',
    name: 'Patent Leather',
    type: 'percentage',
    value: 10,
    reason: 'Patent leather needs careful handling',
  },
  exotic: {
    id: 'exotic-surcharge',
    name: 'Exotic Leather',
    type: 'percentage',
    value: 50,
    reason: 'Exotic leathers require expert handling',
  },
  fabric: null,
  synthetic: null,
  mixed: {
    id: 'mixed-surcharge',
    name: 'Mixed Materials',
    type: 'percentage',
    value: 10,
    reason: 'Multiple materials require extra care',
  },
}

/**
 * Condition-based modifiers
 * Poor condition items may need extra work
 */
const CONDITION_MODIFIERS: Record<ConditionRating, PriceModifier | null> = {
  excellent: null,
  good: null,
  fair: null,
  poor: {
    id: 'poor-condition',
    name: 'Heavy Restoration',
    type: 'percentage',
    value: 25,
    reason: 'Item in poor condition requires extra restoration work',
  },
}

/**
 * Get applicable modifiers for an item based on its properties
 */
export function getModifiersForItem(
  material?: MaterialType,
  condition?: ConditionRating
): PriceModifier[] {
  const modifiers: PriceModifier[] = []

  // Add material modifier if applicable
  if (material && MATERIAL_MODIFIERS[material]) {
    modifiers.push(MATERIAL_MODIFIERS[material]!)
  }

  // Add condition modifier if applicable
  if (condition && CONDITION_MODIFIERS[condition]) {
    modifiers.push(CONDITION_MODIFIERS[condition]!)
  }

  return modifiers
}

/**
 * Apply modifiers to a base price
 */
function applyModifiers(basePrice: number, modifiers: PriceModifier[]): number {
  let adjustedPrice = basePrice

  for (const modifier of modifiers) {
    if (modifier.type === 'percentage') {
      adjustedPrice += basePrice * (modifier.value / 100)
    } else {
      adjustedPrice += modifier.value
    }
  }

  return adjustedPrice
}

/**
 * Calculate total modifier amount for a base price
 */
function calculateModifierAmount(basePrice: number, modifiers: PriceModifier[]): number {
  let total = 0

  for (const modifier of modifiers) {
    if (modifier.type === 'percentage') {
      total += basePrice * (modifier.value / 100)
    } else {
      total += modifier.value
    }
  }

  return total
}

/**
 * Calculate prices for all selected services
 */
export function calculatePrices(
  selectedServices: SelectedServiceWithQuantity[],
  material?: MaterialType,
  condition?: ConditionRating
): PriceCalculationResult {
  // Get applicable modifiers for this item
  const itemModifiers = getModifiersForItem(material, condition)

  // Calculate line items
  const lineItems: PriceLineItem[] = selectedServices.map(({ service, quantity }) => {
    const basePrice = service.price
    const priceWithModifiers = applyModifiers(basePrice, itemModifiers)
    const lineTotal = priceWithModifiers * quantity

    return {
      serviceId: service.id,
      variantId: service.variant_id,
      serviceName: service.title,
      quantity,
      basePrice,
      modifiers: itemModifiers,
      lineTotal,
    }
  })

  // Calculate totals
  const subtotal = selectedServices.reduce(
    (sum, { service, quantity }) => sum + service.price * quantity,
    0
  )

  const modifiersTotal = selectedServices.reduce(
    (sum, { service, quantity }) =>
      sum + calculateModifierAmount(service.price, itemModifiers) * quantity,
    0
  )

  const grandTotal = subtotal + modifiersTotal

  return {
    lineItems,
    subtotal,
    modifiersTotal,
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
