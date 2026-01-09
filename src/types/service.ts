/**
 * Service Types
 *
 * Services are the repair/cleaning options available to customers.
 * They come from Shopify (as products) but we also store which ones
 * are selected for each item.
 */

// ============================================
// Shopify Service (from product catalog)
// ============================================

/** A service from the Shopify product catalog */
export interface ShopifyService {
  id: string                    // Shopify product ID
  variant_id: string            // Shopify variant ID (for cart)
  title: string                 // e.g., "Ladies Shoe Cleaning"
  description?: string          // Detailed description

  // Pricing
  price: number                 // Base price in AED
  currency: string              // Always 'AED'

  // Categorization
  category?: string             // Which items this applies to
  tags: string[]                // Shopify tags for filtering

  // Turnaround
  estimated_days?: number       // How long this service takes

  // Status
  is_active: boolean            // Can we sell this?
}

// ============================================
// Price Modifier
// ============================================

/** A modifier that adjusts the price */
export interface PriceModifier {
  id: string
  name: string                  // e.g., "Suede Surcharge", "Rush Service"
  type: 'percentage' | 'fixed'  // Add X% or add flat amount
  value: number                 // The percentage or amount
  reason?: string               // Why this was applied
}

// ============================================
// Selected Service (stored in database)
// ============================================

/** A service selected for a specific item */
export interface ItemService {
  id: string                    // UUID from database
  item_id: string               // Parent item
  created_at: string            // ISO timestamp

  // Shopify reference
  shopify_product_id?: string
  shopify_variant_id?: string
  service_name: string          // Human-readable name

  // Pricing
  quantity: number
  base_price?: number           // Original price
  final_price?: number          // After modifiers

  // Modifiers applied
  modifiers: PriceModifier[]

  // AI suggestion info
  ai_suggested: boolean         // Did AI recommend this?
  ai_confidence?: number        // How confident was the AI?
  ai_reason?: string            // Why did AI suggest this?
}

// ============================================
// Helper Types
// ============================================

/** For creating a new item service */
export type NewItemService = Omit<ItemService, 'id' | 'created_at'>

/** For adding a service to an item */
export interface AddServiceRequest {
  item_id: string
  shopify_product_id?: string
  shopify_variant_id?: string
  service_name: string
  quantity?: number
  base_price?: number
  ai_suggested?: boolean
  ai_confidence?: number
  ai_reason?: string
}
