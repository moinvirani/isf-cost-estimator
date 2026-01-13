/**
 * Training Types
 *
 * Types for the AI training system.
 * Training examples are image + correct service pairs used to improve AI recommendations.
 */

import type { DetectedIssue, ItemCategory, MaterialType, ConditionRating } from './item'

// ============================================
// Training Example (stored in database)
// ============================================

export interface TrainingExample {
  id: string
  created_at: string
  updated_at: string

  // Image data
  image_url: string
  image_source: 'zoko' | 'manual'

  // Zoko reference
  zoko_customer_id?: string
  zoko_message_id?: string
  zoko_customer_name?: string

  // AI analysis
  ai_category?: ItemCategory
  ai_sub_type?: string
  ai_material?: MaterialType
  ai_condition?: ConditionRating
  ai_issues?: DetectedIssue[]

  // Correct services (verified by staff)
  correct_services: CorrectService[]

  // Verification
  verified_by?: string
  verified_at?: string
  notes?: string
  status: 'pending' | 'verified' | 'rejected'
}

export interface CorrectService {
  service_name: string       // e.g., "Shampoo Suede"
  shopify_product_id?: string
  quantity: number
}

// ============================================
// Zoko Conversation for Training
// ============================================

// Single image in a group
export interface ZokoImage {
  url: string
  caption?: string
  messageId: string
  timestamp: string
}

// Simplified order info for training display
export interface MatchingOrder {
  id: string
  name: string           // Order number like #1234
  createdAt: string
  totalPrice: string
  lineItems: Array<{
    title: string
    quantity: number
    price: string
  }>
}

// Group of images (same item, different angles)
export interface ZokoConversationForTraining {
  customerId: string
  customerName: string
  customerPhone?: string // WhatsApp phone number for order lookup
  // Multiple images grouped together (different angles of same item)
  images: ZokoImage[]
  // Legacy single image support (deprecated)
  imageUrl?: string
  imageCaption?: string
  messageId?: string
  timestamp: string
  // Whether this customer has Shopify orders matching this image group
  hasOrders?: boolean
  // Matching orders (created within 7 days after images were sent)
  matchingOrders?: MatchingOrder[]
  // Messages around the images (for context)
  contextMessages: Array<{
    direction: 'FROM_CUSTOMER' | 'FROM_STORE'
    text: string
    timestamp: string
  }>
}

// ============================================
// API Types
// ============================================

export interface FetchZokoImagesResponse {
  success: boolean
  conversations?: ZokoConversationForTraining[]
  error?: string
  hasMore?: boolean
  nextPage?: number
}

export interface SaveTrainingExampleRequest {
  image_url: string
  image_source: 'zoko' | 'manual'
  zoko_customer_id?: string
  zoko_message_id?: string
  zoko_customer_name?: string
  ai_category?: string
  ai_sub_type?: string
  ai_material?: string
  ai_condition?: string
  ai_issues?: DetectedIssue[]
  correct_services: CorrectService[]
  verified_by: string
  notes?: string
}

// ============================================
// Helper Types
// ============================================

export type NewTrainingExample = Omit<TrainingExample, 'id' | 'created_at' | 'updated_at'>
