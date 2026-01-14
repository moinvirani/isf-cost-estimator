/**
 * Queue Types
 *
 * Types for the Zoko lead queue system.
 */

import type { AIAnalysisResult } from './item'

// Lead status values
export type LeadStatus = 'new' | 'claimed' | 'analyzed' | 'quoted' | 'completed' | 'skipped'

// Image from Zoko message
export interface QueueImage {
  url: string
  messageId: string
  timestamp: string
  caption?: string
}

// Context message from conversation
export interface ContextMessage {
  direction: 'FROM_CUSTOMER' | 'FROM_STORE'
  text: string
  timestamp: string
}

// Selected service for a lead
export interface SelectedServiceData {
  serviceId: string
  variantId: string
  serviceName: string
  quantity: number
  price: number
  aiSuggested: boolean
}

// Saved product group (for persisting analysis)
export interface SavedProductGroup {
  id: string
  imageIds: string[]
  analysis: AIAnalysisResult | null
  selectedServices: SelectedServiceData[]
}

// Main lead type (from database)
export interface ZokoLead {
  id: string
  created_at: string
  updated_at: string

  // Zoko customer info
  zoko_customer_id: string
  customer_name: string | null
  customer_phone: string | null

  // Images and messages
  images: QueueImage[]
  context_messages: ContextMessage[]

  // Status
  status: LeadStatus

  // Assignment
  claimed_by: string | null
  claimed_at: string | null

  // Analysis results (saved product groups with analyses)
  analysis_result: SavedProductGroup[] | null
  selected_services: SelectedServiceData[] | null

  // Draft order
  estimation_id: string | null
  draft_order_id: string | null
  draft_order_url: string | null

  // Timestamps
  first_image_at: string
  completed_at: string | null

  // Notes
  notes: string | null
}

// API response for queue list
export interface QueueListResponse {
  success: boolean
  leads: ZokoLead[]
  total: number
  error?: string
}

// API response for single lead
export interface QueueLeadResponse {
  success: boolean
  lead?: ZokoLead
  error?: string
}

// API response for sync
export interface QueueSyncResponse {
  success: boolean
  added: number
  skipped: number
  error?: string
}

// Claim request body
export interface ClaimRequest {
  claimedBy: string
}

// Analyze request body
export interface AnalyzeLeadRequest {
  analysisResult: AIAnalysisResult
  selectedServices: SelectedServiceData[]
}

// Training data for each product/item
export interface ProductTrainingData {
  imageUrls: string[]              // Image URLs for this product
  analysis: {
    category: string
    subType: string
    material: string
    condition: string
    issues: Array<{ type: string; severity: string; location: string }>
  } | null
  services: Array<{
    serviceName: string
    serviceId: string
  }>
}

// Complete request body
export interface CompleteLeadRequest {
  estimationId?: string
  draftOrderId?: string
  draftOrderUrl?: string
  // Training data for all products
  trainingData?: ProductTrainingData[]
}

// Skip request body
export interface SkipLeadRequest {
  reason?: string
}

// Filter options for queue list
export interface QueueFilters {
  status?: LeadStatus | 'all'
  claimedBy?: string
  limit?: number
  offset?: number
}
