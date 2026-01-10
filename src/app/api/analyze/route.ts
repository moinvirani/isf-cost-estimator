/**
 * Image Analysis API Route
 *
 * POST /api/analyze
 *
 * Receives image URLs and returns AI analysis results.
 * Uses GPT-4 Vision to analyze shoes/bags/leather goods.
 */

import { NextRequest, NextResponse } from 'next/server'
import openai from '@/lib/ai/openai'
import { buildAnalysisMessages } from '@/lib/ai/prompts'
import type { AIAnalysisResult } from '@/types/item'

// Request body type
interface AnalyzeRequest {
  imageUrl: string
}

// Response type
interface AnalyzeResponse {
  success: boolean
  analysis?: AIAnalysisResult
  error?: string
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

    // Build messages for GPT-4 Vision
    const messages = buildAnalysisMessages(body.imageUrl)

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
    let analysis: AIAnalysisResult

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

      analysis = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      return NextResponse.json(
        { success: false, error: 'Invalid AI response format' },
        { status: 500 }
      )
    }

    // Return the analysis
    return NextResponse.json({
      success: true,
      analysis,
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
