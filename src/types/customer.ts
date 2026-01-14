/**
 * Customer App Types
 *
 * Types for B2C iOS app: customers, quotes, pickups
 */

// ============================================
// CUSTOMER
// ============================================

export interface Customer {
  id: string
  phone: string
  email: string | null
  name: string | null
  shopify_customer_id: string | null
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export interface CustomerProfile {
  id: string
  phone: string
  email: string | null
  name: string | null
}

// ============================================
// QUOTE REQUEST
// ============================================

export type QuoteStatus =
  | 'pending_ai'      // Waiting for AI analysis
  | 'pending_staff'   // Needs staff review
  | 'quoted'          // Quote ready, waiting for customer
  | 'accepted'        // Customer accepted, pending payment
  | 'paid'            // Payment received
  | 'pickup_scheduled' // Pickup scheduled
  | 'in_progress'     // Item being repaired
  | 'completed'       // Done
  | 'cancelled'       // Cancelled

export type QuoteType = 'instant' | 'staff_review'

export interface QuoteService {
  name: string
  price: number
  variant_id?: string
}

export interface QuoteIssue {
  type: string
  severity: 'minor' | 'moderate' | 'severe'
  location: string
  description: string
}

export interface QuoteAIAnalysis {
  category: 'shoes' | 'bags' | 'other_leather'
  sub_type: string
  material: string
  color: string
  brand: string | null
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  issues: QuoteIssue[]
  suggested_services: string[]
  confidence: number
}

export interface QuoteRequest {
  id: string
  customer_id: string
  images: string[]
  ai_analysis: QuoteAIAnalysis | null
  ai_suggested_services: string[]
  status: QuoteStatus
  quote_type: QuoteType
  estimated_price_min: number | null
  estimated_price_max: number | null
  final_price: number | null
  currency: string
  services: QuoteService[]
  reviewed_by: string | null
  reviewed_at: string | null
  staff_notes: string | null
  draft_order_id: string | null
  draft_order_url: string | null
  payment_url: string | null
  customer_notes: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
}

// ============================================
// PICKUP REQUEST
// ============================================

export type PickupStatus =
  | 'scheduled'
  | 'confirmed'
  | 'picked_up'
  | 'delivered_to_isf'
  | 'cancelled'

export interface PickupAddress {
  street: string
  building: string
  city: string
  emirate: string
  notes?: string
}

export interface PickupRequest {
  id: string
  quote_request_id: string
  customer_id: string
  address: PickupAddress
  preferred_date: string
  preferred_time_slot: string
  status: PickupStatus
  courier_name: string | null
  courier_tracking: string | null
  picked_up_at: string | null
  delivered_at: string | null
  special_instructions: string | null
  created_at: string
  updated_at: string
}

// ============================================
// PUSH TOKEN
// ============================================

export interface PushToken {
  id: string
  customer_id: string
  token: string
  platform: 'ios' | 'android'
  device_name: string | null
  created_at: string
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

// Auth
export interface SendOtpRequest {
  phone: string
}

export interface SendOtpResponse {
  success: boolean
  message?: string
  error?: string
}

export interface VerifyOtpRequest {
  phone: string
  otp: string
}

export interface VerifyOtpResponse {
  success: boolean
  token?: string
  customer?: CustomerProfile
  isNewCustomer?: boolean
  error?: string
}

// Profile
export interface UpdateProfileRequest {
  name?: string
  email?: string
}

export interface ProfileResponse {
  success: boolean
  customer?: CustomerProfile
  error?: string
}

// Quotes
export interface CreateQuoteRequest {
  images: string[]
  notes?: string
}

export interface QuoteResponse {
  success: boolean
  quote?: QuoteRequest
  message?: string
  error?: string
}

export interface QuoteListResponse {
  success: boolean
  quotes?: QuoteRequest[]
  error?: string
}

export interface AcceptQuoteResponse {
  success: boolean
  payment_url?: string
  draft_order_id?: string
  error?: string
}

// Pickup
export interface CreatePickupRequest {
  quote_id: string
  address: PickupAddress
  preferred_date: string
  preferred_time_slot: string
  notes?: string
}

export interface PickupResponse {
  success: boolean
  pickup?: PickupRequest
  error?: string
}

// Push Token
export interface RegisterPushTokenRequest {
  token: string
  platform: 'ios' | 'android'
  device_name?: string
}

export interface PushTokenResponse {
  success: boolean
  error?: string
}

// ============================================
// CONSTANTS
// ============================================

// Services that qualify for instant (AI-only) quotes
export const INSTANT_QUOTE_SERVICES = [
  'Shoe Shine',
  'Bag Cleaning',
  'Leather Conditioning',
  'Basic Polishing',
  'Dust Bag Cleaning',
  'Multi-Material Cleaning',
]

// Time slots for pickup
export const PICKUP_TIME_SLOTS = [
  { value: '09:00-12:00', label: 'Morning (9 AM - 12 PM)' },
  { value: '12:00-16:00', label: 'Afternoon (12 PM - 4 PM)' },
  { value: '16:00-20:00', label: 'Evening (4 PM - 8 PM)' },
]

// UAE Emirates
export const UAE_EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
]
