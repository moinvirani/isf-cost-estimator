/**
 * Image Analysis API Route
 *
 * POST /api/analyze
 *
 * Receives image URLs and returns AI analysis results.
 * Uses GPT-4 Vision to analyze shoes/bags/leather goods.
 * Fetches real Shopify services to give AI exact service names.
 * Includes few-shot examples from training data to improve recommendations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import openai from '@/lib/ai/openai'
import { buildAnalysisMessages } from '@/lib/ai/prompts'
import { fetchShopifyServices } from '@/lib/shopify/services'
import { requireAuth } from '@/lib/supabase/api-auth'
import type { AIAnalysisResult, AIMultiItemResponse } from '@/types/item'

// Request body type - supports multiple images of the same item
interface AnalyzeRequest {
  imageUrls: string[]   // Multiple images of the SAME item (different angles)
  imageUrl?: string     // DEPRECATED: single image (for backward compatibility)
  contextMessages?: string[]  // Optional: Customer messages for context (brand hints, issue descriptions)
}

// Response type - returns array of analyses (one per detected item)
interface AnalyzeResponse {
  success: boolean
  analyses?: AIAnalysisResult[]  // Array of analyses (one per distinct item)
  error?: string
}

// Training pattern type for aggregated data
interface TrainingPattern {
  category: string
  material: string
  issue: string
  service: string
  count: number
}

/**
 * Fetch and aggregate training patterns for statistical few-shot learning
 * Returns patterns like: "heel_damage on shoes (leather) → Rubber Heel (verified 12x)"
 */
async function fetchTrainingPatterns(): Promise<TrainingPattern[]> {
  try {
    const supabase = getSupabaseClient()
    // Fetch more examples for statistical significance
    const { data } = await supabase
      .from('training_examples')
      .select('ai_category, ai_material, ai_issues, correct_services')
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!data || data.length === 0) return []

    // Aggregate: count how often each issue → service mapping occurs
    const patterns = new Map<string, { count: number; services: string[] }>()

    for (const ex of data) {
      const category = ex.ai_category || 'item'
      const material = ex.ai_material || 'leather'
      const issues = (ex.ai_issues || []) as Array<{ type: string }>
      const services = (ex.correct_services || []) as Array<{ service_name: string }>

      // If no issues, use 'general_care' as a catch-all
      const issueTypes = issues.length > 0
        ? issues.map(i => i.type)
        : ['general_care']

      for (const issueType of issueTypes) {
        const key = `${category}|${material}|${issueType}`
        const serviceNames = services.map(s => s.service_name)

        if (!patterns.has(key)) {
          patterns.set(key, { count: 0, services: [] })
        }
        const p = patterns.get(key)!
        p.count++
        p.services.push(...serviceNames)
      }
    }

    // Return patterns - include even single examples for small datasets
    const result = Array.from(patterns.entries())
      .filter(([, v]) => v.count >= 1)
      .map(([key, v]) => {
        const [category, material, issue] = key.split('|')
        // Find most common service for this pattern
        const serviceCounts = v.services.reduce((acc, s) => {
          acc[s] = (acc[s] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        const topService = Object.entries(serviceCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || ''

        return { category, material, issue, service: topService, count: v.count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15) // Top 15 patterns

    console.log('Training patterns generated:', result.length, 'patterns')
    if (result.length > 0) {
      console.log('Sample patterns:', result.slice(0, 3))
    }

    return result
  } catch (error) {
    console.error('Failed to fetch training patterns:', error)
    return []
  }
}

/**
 * Validate that a URL is safe to fetch (SSRF prevention)
 * - Only allows HTTPS protocol
 * - Blocks private IP ranges and cloud metadata endpoints
 * - Allowlists trusted image hosting domains
 */
function isAllowedImageUrl(url: string): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(url)

    // Only allow HTTPS (block file://, ftp://, etc.)
    if (parsed.protocol !== 'https:') {
      return { allowed: false, reason: 'Only HTTPS URLs are allowed' }
    }

    const hostname = parsed.hostname.toLowerCase()

    // Block localhost and loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { allowed: false, reason: 'Localhost URLs are not allowed' }
    }

    // Block cloud metadata endpoints (AWS, GCP, Azure)
    const metadataHosts = [
      '169.254.169.254',      // AWS/GCP metadata
      'metadata.google.internal',
      'metadata.google',
      '100.100.100.200',      // Alibaba Cloud metadata
    ]
    if (metadataHosts.includes(hostname)) {
      return { allowed: false, reason: 'Cloud metadata endpoints are not allowed' }
    }

    // Block private IP ranges
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number)
      // 10.0.0.0/8
      if (a === 10) {
        return { allowed: false, reason: 'Private IP addresses are not allowed' }
      }
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) {
        return { allowed: false, reason: 'Private IP addresses are not allowed' }
      }
      // 192.168.0.0/16
      if (a === 192 && b === 168) {
        return { allowed: false, reason: 'Private IP addresses are not allowed' }
      }
      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) {
        return { allowed: false, reason: 'Link-local addresses are not allowed' }
      }
      // 127.0.0.0/8 (loopback)
      if (a === 127) {
        return { allowed: false, reason: 'Loopback addresses are not allowed' }
      }
    }

    // Allowlist trusted image hosting domains
    const allowedDomains = [
      '.supabase.co',           // Supabase Storage
      '.supabase.in',           // Supabase alternative domain
      'storage.googleapis.com', // Google Cloud Storage (Zoko images)
      '.googleusercontent.com', // Google user content
    ]

    const isAllowedDomain = allowedDomains.some(domain => {
      if (domain.startsWith('.')) {
        return hostname.endsWith(domain) || hostname === domain.slice(1)
      }
      return hostname === domain
    })

    if (!isAllowedDomain) {
      return { allowed: false, reason: `Domain '${hostname}' is not in the allowlist` }
    }

    return { allowed: true }
  } catch {
    return { allowed: false, reason: 'Invalid URL format' }
  }
}

/**
 * Convert image URL to base64 data URL
 * This avoids OpenAI timeout issues when fetching from Supabase Storage
 */
async function imageUrlToBase64(url: string): Promise<string> {
  // Validate URL before fetching (SSRF prevention)
  const validation = isAllowedImageUrl(url)
  if (!validation.allowed) {
    throw new Error(`URL validation failed: ${validation.reason}`)
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  // Determine content type from response or URL
  const contentType = response.headers.get('content-type') || 'image/jpeg'

  return `data:${contentType};base64,${base64}`
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  // Allow internal calls from customer-app service to bypass auth
  // This enables /api/customer/quotes to call this endpoint internally
  const internalService = request.headers.get('X-Internal-Service')
  const isInternalCall = internalService === 'customer-app'

  if (!isInternalCall) {
    // Require authentication for external (staff) calls
    const { error: authError } = await requireAuth(request)
    if (authError) return authError as NextResponse<AnalyzeResponse>
  }

  try {
    // Parse request body
    const body: AnalyzeRequest = await request.json()

    // Support both new (imageUrls) and legacy (imageUrl) format
    const imageUrls = body.imageUrls || (body.imageUrl ? [body.imageUrl] : [])

    // Extract optional context messages (customer messages for brand hints, etc.)
    const contextMessages = body.contextMessages || []

    // Validate input
    if (imageUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one image URL is required' },
        { status: 400 }
      )
    }

    // Validate all URLs before processing (SSRF prevention)
    for (const url of imageUrls) {
      const validation = isAllowedImageUrl(url)
      if (!validation.allowed) {
        return NextResponse.json(
          { success: false, error: `Invalid image URL: ${validation.reason}` },
          { status: 400 }
        )
      }
    }

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set')
      return NextResponse.json(
        { success: false, error: 'AI service not configured' },
        { status: 500 }
      )
    }

    // Convert image URLs to base64 to avoid OpenAI timeout issues
    // OpenAI sometimes can't fetch from Supabase Storage in time
    console.log('Converting images to base64...')
    const base64Images = await Promise.all(
      imageUrls.map(async (url) => {
        try {
          return await imageUrlToBase64(url)
        } catch (error) {
          console.error(`Failed to convert image to base64: ${url}`, error)
          // Fall back to original URL if conversion fails
          return url
        }
      })
    )
    console.log('Conversion complete, sending to OpenAI...')

    // Fetch Shopify services and training patterns in parallel
    const [shopifyServices, trainingPatterns] = await Promise.all([
      fetchShopifyServices(),
      fetchTrainingPatterns(),
    ])

    // Build messages for GPT-4 Vision (with base64 images and optional context)
    const messages = buildAnalysisMessages(base64Images, shopifyServices, trainingPatterns, contextMessages)

    // Call OpenAI API - increase max_tokens for bbox data
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Using GPT-4o which has vision capabilities
      messages,
      max_tokens: 2000, // Increased for bbox coordinates
      temperature: 0.3, // Lower temperature for more consistent analysis
    })

    // Extract the response content
    const content = completion.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'No response from AI' },
        { status: 500 }
      )
    }

    // Parse the JSON response
    let parsedResponse: AIMultiItemResponse

    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanContent = content.trim()
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7)
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3)
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3)
      }
      cleanContent = cleanContent.trim()

      const rawParsed = JSON.parse(cleanContent)

      // Handle both old format (single item) and new format (items array)
      if (rawParsed.items && Array.isArray(rawParsed.items)) {
        // New format: { items: [...], total_items: N }
        parsedResponse = rawParsed as AIMultiItemResponse
      } else {
        // Old format: single item object - wrap in array
        // Add imageIndices if missing (assume all images belong to this item)
        const singleItem = rawParsed as AIAnalysisResult
        if (!singleItem.imageIndices) {
          singleItem.imageIndices = Array.from({ length: base64Images.length }, (_, i) => i)
        }
        parsedResponse = {
          items: [singleItem],
          total_items: 1,
        }
      }

      // Ensure all items have imageIndices
      parsedResponse.items = parsedResponse.items.map((item, idx) => {
        if (!item.imageIndices || item.imageIndices.length === 0) {
          // Fallback: assign image indices based on position
          item.imageIndices = [idx]
        }
        return item
      })
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      return NextResponse.json(
        { success: false, error: 'Invalid AI response format' },
        { status: 500 }
      )
    }

    // Return array of analyses (one per distinct item)
    return NextResponse.json({
      success: true,
      analyses: parsedResponse.items,
    })
  } catch (error) {
    console.error('Analysis error:', error)

    // Get error message for better debugging
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error details:', errorMessage)

    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { success: false, error: 'Invalid API key' },
          { status: 401 }
        )
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { success: false, error: `Failed to analyze image: ${errorMessage}` },
      { status: 500 }
    )
  }
}
