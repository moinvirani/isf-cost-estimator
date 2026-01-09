/**
 * Estimation Types
 *
 * These types match the database schema and define the shape of our data.
 * TypeScript uses these to catch errors at compile time.
 */

// ============================================
// Status Types
// ============================================

/** Possible statuses for an estimation */
export type EstimationStatus =
  | 'draft'         // Just started, images not analyzed yet
  | 'analyzing'     // AI is processing the images
  | 'review'        // Ready for staff to review
  | 'confirmed'     // Staff has confirmed the services
  | 'order_created' // Shopify draft order was created

// ============================================
// Main Estimation Type
// ============================================

/** A single estimation session (can contain multiple items) */
export interface Estimation {
  id: string                    // UUID from database
  created_at: string            // ISO timestamp
  updated_at: string            // ISO timestamp
  status: EstimationStatus

  // Customer info (optional)
  customer_phone?: string
  customer_name?: string

  // Pricing
  grand_total: number           // Total in AED
  currency: string              // Always 'AED' for now

  // Turnaround
  estimated_days?: number       // Max days across all services
  rush_requested: boolean       // Did they want rush service?

  // Shopify output
  draft_order_id?: string       // Shopify draft order ID
  draft_order_url?: string      // Shareable checkout link

  // Text output
  customer_message?: string     // Generated message for customer
  staff_notes?: string          // Internal notes
}

// ============================================
// Helper Types
// ============================================

/** For creating a new estimation (server generates id, timestamps) */
export type NewEstimation = Omit<Estimation, 'id' | 'created_at' | 'updated_at'>

/** For updating an existing estimation */
export type EstimationUpdate = Partial<Omit<Estimation, 'id' | 'created_at'>>

// ============================================
// Full Estimation with Items
// ============================================

import type { EstimationItem } from './item'

/** Estimation with all its items loaded */
export interface EstimationWithItems extends Estimation {
  items: EstimationItem[]
}
