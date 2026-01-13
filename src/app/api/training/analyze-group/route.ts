/**
 * POST /api/training/analyze-group
 *
 * Analyzes a group of images showing the same item from different angles.
 * Returns detailed analysis including brand/model identification.
 * Used during training to get detailed item analysis before saving.
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ImageForAnalysis {
  url: string
  messageId?: string
}

interface AnalyzeGroupRequest {
  images: ImageForAnalysis[]
  // Pre-identified brand/model from grouping (optional, helps confirm)
  preIdentified?: {
    brand?: string
    model?: string
    category?: string
    itemDescription?: string
  }
}

interface AnalyzeGroupResponse {
  success: boolean
  analysis?: {
    // Item identification
    brand?: string           // e.g., "Hermes", "Chanel"
    model?: string           // e.g., "Birkin 30", "Classic Flap"
    category: string         // "shoes", "bags", "other_leather"
    subType?: string         // "handbag", "sneakers", "wallet"

    // Material & condition
    material: string         // "smooth_leather", "suede", etc.
    color: string
    condition: string        // "excellent", "good", "fair", "poor"

    // Issues detected
    issues: Array<{
      type: string
      severity: string
      location: string
      description: string
    }>

    // Service recommendations
    suggestedServices: string[]

    // Analysis metadata
    confidence: number
    notes?: string
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeGroupResponse>> {
  try {
    const body: AnalyzeGroupRequest = await request.json()

    if (!body.images || body.images.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No images provided',
      }, { status: 400 })
    }

    // Build image content for the API call
    const imageContents: OpenAI.Chat.Completions.ChatCompletionContentPart[] = body.images.map((img) => ({
      type: 'image_url' as const,
      image_url: {
        url: img.url,
        detail: 'high' as const, // Use high detail for detailed analysis
      },
    }))

    // Build pre-identification context if available
    let preIdContext = ''
    if (body.preIdentified) {
      const parts = []
      if (body.preIdentified.brand) parts.push(`Brand: ${body.preIdentified.brand}`)
      if (body.preIdentified.model) parts.push(`Model: ${body.preIdentified.model}`)
      if (body.preIdentified.category) parts.push(`Category: ${body.preIdentified.category}`)
      if (body.preIdentified.itemDescription) parts.push(`Description: ${body.preIdentified.itemDescription}`)
      if (parts.length > 0) {
        preIdContext = `\n\nPrevious analysis suggested:\n${parts.join('\n')}\nPlease confirm or correct this identification.`
      }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert luxury goods appraiser for Italian Shoe Factory (ISF), a premium repair service in Dubai.

You are analyzing ${body.images.length} image(s) of the SAME item from different angles.

Your expertise includes:
- Authenticating and identifying luxury brands (Hermes, Chanel, Louis Vuitton, Gucci, Prada, Dior, etc.)
- Assessing leather quality, condition, and material types
- Identifying repair needs and recommending services

Brand identification tips:
- Hermes: H logo, saddle stitching (angled), Birkin/Kelly shapes, Clochette lock
- Chanel: Interlocking CC logo, quilted leather, chain straps, turnlock closure
- Louis Vuitton: LV monogram canvas, Damier pattern, distinctive gold hardware
- Gucci: GG logo, green-red-green stripe, horsebit hardware
- Prada: Triangle logo plate, Saffiano leather texture
- Dior: CD oblique pattern, saddle bag shapes, Lady Dior cannage

Respond ONLY with valid JSON. No text before or after.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze these ${body.images.length} image(s) showing different angles of the same item.${preIdContext}

Respond with ONLY valid JSON:
{
  "brand": "<brand name or null if not identifiable>",
  "model": "<specific model name like 'Birkin 30', 'Classic Flap Medium', or null>",
  "category": "shoes" | "bags" | "other_leather",
  "subType": "<specific type: 'handbag', 'clutch', 'wallet', 'sneakers', 'heels', 'loafers', 'belt', etc.>",
  "material": "smooth_leather" | "suede" | "nubuck" | "patent" | "exotic" | "canvas" | "fabric" | "synthetic" | "mixed",
  "color": "<primary color>",
  "condition": "excellent" | "good" | "fair" | "poor",
  "issues": [
    {
      "type": "<scuff, stain, scratch, tear, heel_damage, sole_wear, color_fade, water_damage, broken_hardware, etc.>",
      "severity": "minor" | "moderate" | "severe",
      "location": "<toe, heel, sole, handle, strap, zipper, hardware, lining, etc.>",
      "description": "<brief description>"
    }
  ],
  "suggestedServices": ["<exact service names from ISF menu>"],
  "confidence": <0.0 to 1.0>,
  "notes": "<any additional observations>"
}

ISF Services:
BAGS: "Bags I Cleaning & Refresh", "Bags | Zipper Repair", "Bags | Lining Repair/Change", "Bags | Gold Plating", "Bags | Color Restoration"
SHOES: "Men's | Heel Top-Lift Replacement", "Women's | Glissoire", "Shampoo Suede", "Stitching", "Sneaker | Spa", "Sneaker | Color Restoration"`,
            },
            ...imageContents,
          ],
        },
      ],
      max_tokens: 800,
      temperature: 0.2, // Lower temperature for consistent analysis
    })

    const content = response.choices[0]?.message?.content || ''

    // Parse the JSON response
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      return NextResponse.json({
        success: true,
        analysis: {
          brand: parsed.brand || undefined,
          model: parsed.model || undefined,
          category: parsed.category || 'other_leather',
          subType: parsed.subType || undefined,
          material: parsed.material || 'smooth_leather',
          color: parsed.color || 'unknown',
          condition: parsed.condition || 'fair',
          issues: parsed.issues || [],
          suggestedServices: parsed.suggestedServices || [],
          confidence: parsed.confidence || 0.5,
          notes: parsed.notes || undefined,
        },
      })
    } catch (parseError) {
      console.error('Failed to parse AI analysis response:', content)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response',
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error analyzing group:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze images',
    }, { status: 500 })
  }
}
