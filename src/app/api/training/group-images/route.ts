/**
 * POST /api/training/group-images
 *
 * Uses GPT-4 Vision to analyze images and group them by item.
 * Detects if images show the same item (different angles) or different items.
 *
 * Input: Array of image URLs from the same conversation
 * Output: Array of image groups, each group is one distinct item
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ImageInput {
  url: string
  messageId: string
  timestamp: string
  caption?: string
}

interface ImageGroup {
  groupId: string
  images: ImageInput[]
  itemDescription: string // AI's description of what the item is
  // Brand/model identification
  brand?: string         // e.g., "Hermes", "Chanel", "Louis Vuitton"
  model?: string         // e.g., "Birkin 30", "Classic Flap", "Neverfull"
  category?: string      // e.g., "handbag", "shoes", "wallet"
}

interface GroupImagesRequest {
  images: ImageInput[]
}

interface GroupImagesResponse {
  success: boolean
  groups?: ImageGroup[]
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<GroupImagesResponse>> {
  try {
    const body: GroupImagesRequest = await request.json()

    if (!body.images || body.images.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No images provided',
      }, { status: 400 })
    }

    // If only 1 image, no grouping needed
    if (body.images.length === 1) {
      return NextResponse.json({
        success: true,
        groups: [{
          groupId: `single-${Date.now()}`,
          images: body.images,
          itemDescription: 'Single image',
        }],
      })
    }

    // For 2-6 images, use AI to group them
    // For more images, batch them to avoid token limits
    const maxImagesPerBatch = 6
    if (body.images.length <= maxImagesPerBatch) {
      const groups = await groupImagesWithAI(body.images)
      return NextResponse.json({
        success: true,
        groups,
      })
    }

    // For many images, process in time-based batches first, then AI within batches
    // This is a fallback for large conversations
    const timeBatches = splitByTimeGaps(body.images, 60 * 60 * 1000) // 1 hour gaps
    const allGroups: ImageGroup[] = []

    for (const batch of timeBatches) {
      if (batch.length <= maxImagesPerBatch) {
        const groups = await groupImagesWithAI(batch)
        allGroups.push(...groups)
      } else {
        // Further split large batches
        const subBatches = chunkArray(batch, maxImagesPerBatch)
        for (const subBatch of subBatches) {
          const groups = await groupImagesWithAI(subBatch)
          allGroups.push(...groups)
        }
      }
    }

    return NextResponse.json({
      success: true,
      groups: allGroups,
    })
  } catch (error) {
    console.error('Error grouping images:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to group images',
    }, { status: 500 })
  }
}

/**
 * Use GPT-4 Vision to analyze images and group by item
 */
async function groupImagesWithAI(images: ImageInput[]): Promise<ImageGroup[]> {
  // Build the prompt with all image URLs
  const imageContents: OpenAI.Chat.Completions.ChatCompletionContentPart[] = images.map((img) => ({
    type: 'image_url' as const,
    image_url: {
      url: img.url,
      detail: 'low' as const, // Use low detail to save tokens
    },
  }))

  // Add image index labels
  const imageLabels = images.map((_, idx) => `Image ${idx + 1}`).join(', ')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert at analyzing images of luxury shoes, bags, and leather goods for a high-end repair shop.

Your task: Look at the provided images and:
1. Determine which images show the SAME item (just different angles) vs DIFFERENT items
2. Identify the BRAND and MODEL if visible (Hermes, Chanel, Louis Vuitton, Gucci, etc.)

Rules for grouping:
- Same item = same shoe/bag photographed from different angles (front, side, back, close-up, etc.)
- Different items = clearly different products (e.g., a shoe and a bag, or two different bags)
- A pair of shoes (left and right) counts as ONE item

Brand identification tips:
- Hermes: H logo, saddle stitching (angled), Birkin/Kelly shapes, Clochette
- Chanel: Interlocking CC logo, quilted leather, chain straps
- Louis Vuitton: LV monogram, Damier pattern, distinctive hardware
- Gucci: GG logo, green-red-green stripe, horsebit hardware
- Prada: Triangle logo plate, Saffiano leather texture
- If brand is not clearly visible, use null

Respond with JSON only, no other text:
{
  "groups": [
    {
      "imageIndices": [0, 1, 2],
      "itemDescription": "Gold Togo leather Birkin 30 handbag",
      "brand": "Hermes",
      "model": "Birkin 30",
      "category": "handbag"
    },
    {
      "imageIndices": [3, 4],
      "itemDescription": "Black caviar leather Classic Flap bag",
      "brand": "Chanel",
      "model": "Classic Flap Medium",
      "category": "handbag"
    }
  ]
}

imageIndices are 0-based indices. Every image must be assigned to exactly one group.
Use null for brand/model if not identifiable.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `I have ${images.length} images (${imageLabels}). Please analyze them and group images that show the same item together.`,
          },
          ...imageContents,
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.1, // Low temperature for consistent grouping
  })

  const content = response.choices[0]?.message?.content || ''

  // Parse the JSON response
  try {
    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    const groups: ImageGroup[] = []

    for (let i = 0; i < parsed.groups.length; i++) {
      const group = parsed.groups[i]
      const groupImages = group.imageIndices.map((idx: number) => images[idx]).filter(Boolean)
      if (groupImages.length > 0) {
        groups.push({
          groupId: `group-${i}-${Date.now()}`,
          images: groupImages,
          itemDescription: group.itemDescription || 'Unknown item',
          brand: group.brand || undefined,
          model: group.model || undefined,
          category: group.category || undefined,
        })
      }
    }

    // Validate all images are assigned
    const assignedCount = groups.reduce((sum, g) => sum + g.images.length, 0)
    if (assignedCount !== images.length) {
      console.warn(`AI grouping: ${assignedCount} images assigned out of ${images.length}`)
      // Add any missing images as separate groups
      const assignedIds = new Set(groups.flatMap(g => g.images.map(img => img.messageId)))
      let unassignedCount = 0
      for (const img of images) {
        if (!assignedIds.has(img.messageId)) {
          groups.push({
            groupId: `unassigned-${unassignedCount++}-${Date.now()}`,
            images: [img],
            itemDescription: 'Unassigned image',
          })
        }
      }
    }

    return groups
  } catch (parseError) {
    console.error('Failed to parse AI grouping response:', content)
    // Fallback: treat all images as separate items
    return images.map((img, idx) => ({
      groupId: `fallback-${idx}-${Date.now()}`,
      images: [img],
      itemDescription: 'Could not determine grouping',
    }))
  }
}

/**
 * Split images into batches based on time gaps
 */
function splitByTimeGaps(images: ImageInput[], gapMs: number): ImageInput[][] {
  if (images.length === 0) return []

  // Sort by timestamp
  const sorted = [...images].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const batches: ImageInput[][] = []
  let currentBatch: ImageInput[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].timestamp).getTime()
    const currTime = new Date(sorted[i].timestamp).getTime()

    if (currTime - prevTime > gapMs) {
      batches.push(currentBatch)
      currentBatch = [sorted[i]]
    } else {
      currentBatch.push(sorted[i])
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

/**
 * Split array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
