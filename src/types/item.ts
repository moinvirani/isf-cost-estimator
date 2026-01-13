/**
 * Item Types
 *
 * An "item" is a single shoe, bag, or leather good within an estimation.
 * Each item has an image, AI analysis results, and selected services.
 */

// ============================================
// Category Types
// ============================================

/** Main categories ISF services */
export type ItemCategory = 'shoes' | 'bags' | 'other_leather'

/** Shoe sub-types */
export type ShoeType = 'mens' | 'womens' | 'kids' | 'unisex'

/** Bag sub-types */
export type BagType = 'handbag' | 'clutch' | 'backpack' | 'wallet' | 'briefcase' | 'tote'

/** Other leather goods */
export type OtherLeatherType = 'belt' | 'jacket' | 'watch_strap' | 'other'

// ============================================
// Material & Condition Types
// ============================================

/** Material types the AI can identify */
export type MaterialType =
  | 'smooth_leather'  // Regular leather
  | 'suede'           // Fuzzy texture
  | 'nubuck'          // Similar to suede but more durable
  | 'patent'          // Shiny/glossy leather
  | 'exotic'          // Crocodile, snake, ostrich, etc.
  | 'fabric'          // Canvas, cloth
  | 'synthetic'       // Faux leather, plastic
  | 'mixed'           // Combination of materials

/** Condition ratings */
export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor'

// ============================================
// AI Analysis Types
// ============================================

/** Bounding box for issue location (normalized 0-1 coordinates) */
export interface IssueBoundingBox {
  x: number           // Left edge (0-1)
  y: number           // Top edge (0-1)
  width: number       // Width (0-1)
  height: number      // Height (0-1)
  imageIndex: number  // Which image in the group shows this issue (0-indexed)
}

/** A single issue detected by the AI */
export interface DetectedIssue {
  type: string          // e.g., 'scuff', 'stain', 'heel_damage'
  severity: 'minor' | 'moderate' | 'severe'
  location: string      // e.g., 'toe_box', 'heel', 'sole'
  description: string   // Human-readable description
  bbox?: IssueBoundingBox  // Bounding box for visual annotation
}

/** Full AI analysis result for a single item */
export interface AIAnalysisResult {
  item_number?: number          // Position in multi-item image (1, 2, 3...)
  position?: string             // Location in image (top, middle, bottom, etc.)
  category: ItemCategory
  sub_type: string
  material: MaterialType
  color: string
  brand?: string | null
  condition: ConditionRating
  issues: DetectedIssue[]
  suggested_services: string[]  // Service names suggested by AI
  confidence: number            // 0.0 to 1.0
  notes?: string                // Any additional AI observations
}

/** Multi-item AI analysis response (new format) */
export interface AIMultiItemResponse {
  items: AIAnalysisResult[]
  total_items: number
}

// ============================================
// Main Item Type
// ============================================

/** A single item within an estimation */
export interface EstimationItem {
  id: string                    // UUID from database
  estimation_id: string         // Parent estimation
  created_at: string            // ISO timestamp

  // Image
  image_url?: string            // Public URL to view the image
  image_path?: string           // Storage path (for deletion)

  // AI Analysis (flattened for easy access)
  category?: ItemCategory
  sub_type?: string
  material?: MaterialType
  color?: string
  brand?: string
  condition?: ConditionRating

  // Full AI response (for debugging/future use)
  ai_analysis?: AIAnalysisResult
  ai_confidence?: number

  // Pricing
  item_subtotal: number

  // Notes
  notes?: string
}

// ============================================
// Helper Types
// ============================================

/** For creating a new item */
export type NewEstimationItem = Omit<EstimationItem, 'id' | 'created_at'>

/** Item with its services loaded */
import type { ItemService, ShopifyService } from './service'

export interface EstimationItemWithServices extends EstimationItem {
  services: ItemService[]
}

// ============================================
// Item Group Types (for multi-image workflow)
// ============================================

/** Single image within an item group */
export interface ItemGroupImage {
  id: string
  url: string           // Supabase storage URL
  previewUrl: string    // Local preview or same as url
}

/** Selected service for an item group */
export interface SelectedServiceForItem {
  service: ShopifyService
  quantity: number
  aiSuggested: boolean
}

/** An item group with multiple images (different angles of same item) */
export interface EstimationItemGroup {
  id: string
  images: ItemGroupImage[]
  analysis: AIAnalysisResult | null
  isAnalyzing: boolean
  analysisError: string | null
  selectedServices: SelectedServiceForItem[]
}
