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
import { createClient } from '@supabase/supabase-js'
import openai from '@/lib/ai/openai'
import { buildAnalysisMessages } from '@/lib/ai/prompts'
import { fetchShopifyServices } from '@/lib/shopify/services'
import type { AIAnalysisResult, AIMultiItemResponse } from '@/types/item'

// Supabase client for fetching training examples
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Request body type
interface AnalyzeRequest {
  imageUrl: string
}

// Response type - now returns array of items (supports multi-item images)
interface AnalyzeResponse {
  success: boolean
  items?: AIAnalysisResult[]      // Array of analyzed items
  total_items?: number            // Total items found in image
  analysis?: AIAnalysisResult     // DEPRECATED: kept for backward compatibility (first item)
  error?: string
}

/**
 * Fetch recent training examples for few-shot learning
 */
async function fetchTrainingExamples() {
  try {
    const { data } = await supabase
      .from('training_examples')
      .select('ai_category, ai_material, ai_condition, correct_services')
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(10)

    return data || []
  } catch (error) {
    console.error('Failed to fetch training examples:', error)
    return []
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  try {
    // Parse request body
    const body: AnalyzeRequest = await request.json()

    // Validate input
    if (!body.imageUrl) {
      return NextResponse.json(
        { success: false, error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set')
      return NextResponse.json(
        { success: false, error: 'AI service not configured' },
        { status: 500 }
      )
    }

    // Fetch Shopify services and training examples in parallel
    const [shopifyServices, trainingExamples] = await Promise.all([
      fetchShopifyServices(),
      fetchTrainingExamples(),
    ])

    // Build messages for GPT-4 Vision (with real service names and training examples)
    const messages = buildAnalysisMessages(body.imageUrl, shopifyServices, trainingExamples)

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Using GPT-4o which has vision capabilities
      messages,
      max_tokens: 1000,
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
    let parsedResponse: AIMultiItemResponse | AIAnalysisResult

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

      parsedResponse = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      return NextResponse.json(
        { success: false, error: 'Invalid AI response format' },
        { status: 500 }
      )
    }

    // Handle both new multi-item format and legacy single-item format
    let items: AIAnalysisResult[]
    let totalItems: number

    if ('items' in parsedResponse && Array.isArray(parsedResponse.items)) {
      // New multi-item format
      items = parsedResponse.items
      totalItems = parsedResponse.total_items || items.length
    } else {
      // Legacy single-item format - wrap in array
      items = [parsedResponse as AIAnalysisResult]
      totalItems = 1
    }

    // Return the analysis with both new and legacy formats
    return NextResponse.json({
      success: true,
      items,
      total_items: totalItems,
      analysis: items[0], // Backward compatibility - first item
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
