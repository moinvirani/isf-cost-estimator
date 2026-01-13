/**
 * AI Analysis Prompts
 *
 * Prompts for GPT-4 Vision to analyze shoe/bag/leather images.
 * Supports multiple images of the same item (different angles).
 * Returns structured JSON with bounding boxes for visual annotations.
 */

import type { ShopifyService } from '@/types/service'

/**
 * System prompt that sets context for the AI.
 * Updated for multi-image analysis of a single item.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are an expert leather goods assessor working for Italian Shoe Factory (ISF), a premium shoe and leather repair service in Dubai.

You will receive one or more images of the SAME item taken from different angles. Your job is to:
1. Combine observations from ALL images to provide comprehensive analysis
2. Identify the item type, material, condition, and brand
3. Detect ALL issues or damage that need repair
4. For each issue, specify which image shows it best and its location in that image
5. Recommend specific services needed

IMPORTANT: All images show the SAME item from different angles. Provide ONE combined analysis.

You must respond ONLY with valid JSON matching the exact structure specified. Do not include any text before or after the JSON.`

/**
 * Build the user prompt with dynamic service list from Shopify
 */
function buildUserPrompt(services: ShopifyService[], imageCount: number): string {
  // Group services by category for better organization
  const sneakerServices = services.filter(s => s.category === 'sneakers')
  const mensServices = services.filter(s => s.category === 'mens_shoes')
  const womensServices = services.filter(s => s.category === 'womens_shoes')
  const bagServices = services.filter(s => s.category === 'bags')
  const generalServices = services.filter(s => !s.category)

  const formatService = (s: ShopifyService) => `- "${s.title}" (AED ${s.price.toFixed(0)})`

  let serviceList = ''

  if (sneakerServices.length > 0) {
    serviceList += `\nSNEAKER SERVICES:\n${sneakerServices.map(formatService).join('\n')}\n`
  }
  if (mensServices.length > 0) {
    serviceList += `\nMEN'S SHOE SERVICES:\n${mensServices.map(formatService).join('\n')}\n`
  }
  if (womensServices.length > 0) {
    serviceList += `\nWOMEN'S SHOE SERVICES:\n${womensServices.map(formatService).join('\n')}\n`
  }
  if (bagServices.length > 0) {
    serviceList += `\nBAG SERVICES:\n${bagServices.map(formatService).join('\n')}\n`
  }
  if (generalServices.length > 0) {
    serviceList += `\nGENERAL SERVICES (applies to all):\n${generalServices.map(formatService).join('\n')}\n`
  }

  const imageIndexNote = imageCount > 1
    ? `\nYou are analyzing ${imageCount} images (indexed 0 to ${imageCount - 1}). For each issue, specify which image (imageIndex) shows it best.`
    : '\nYou are analyzing 1 image (imageIndex: 0).'

  return `Analyze ${imageCount > 1 ? 'these images' : 'this image'} of a single item and provide a detailed assessment.
${imageIndexNote}

Respond with ONLY valid JSON in this exact structure:

{
  "category": "shoes" | "bags" | "other_leather",
  "sub_type": "<specific type - for shoes: 'mens', 'womens', 'kids', 'unisex', 'sneakers'; for bags: 'handbag', 'clutch', 'backpack', 'wallet', 'briefcase', 'tote'; for other: 'belt', 'jacket', 'watch_strap', 'other'>",
  "material": "smooth_leather" | "suede" | "nubuck" | "patent" | "exotic" | "fabric" | "synthetic" | "mixed",
  "color": "<primary color>",
  "brand": "<brand name if visible, or null if not identifiable>",
  "condition": "excellent" | "good" | "fair" | "poor",
  "issues": [
    {
      "type": "<issue type: scuff, stain, scratch, tear, heel_damage, sole_wear, color_fade, water_damage, mold, broken_hardware, etc.>",
      "severity": "minor" | "moderate" | "severe",
      "location": "<location on item: toe_box, heel, sole, upper, strap, handle, zipper, buckle, lining, etc.>",
      "description": "<brief description>",
      "bbox": {
        "x": <left edge as fraction 0-1>,
        "y": <top edge as fraction 0-1>,
        "width": <width as fraction 0-1>,
        "height": <height as fraction 0-1>,
        "imageIndex": <which image shows this issue best (0-indexed)>
      }
    }
  ],
  "suggested_services": ["<EXACT service name from the list below>"],
  "confidence": <0.0 to 1.0 - how confident you are in this analysis>,
  "notes": "<any additional observations>"
}

BOUNDING BOX INSTRUCTIONS (CRITICAL - follow carefully):
- ALL coordinates are NORMALIZED fractions from 0.0 to 1.0 (NOT pixels!)
- x=0.0 is LEFT edge of image, x=1.0 is RIGHT edge
- y=0.0 is TOP edge of image, y=1.0 is BOTTOM edge
- width and height are also fractions (e.g., 0.2 = 20% of image)
- imageIndex: which image (0-indexed) shows this issue most clearly

EXAMPLE: For a scuff on the toe box in the lower-left area of image 0:
{
  "bbox": {
    "x": 0.1,      // 10% from left edge
    "y": 0.6,      // 60% from top (lower area)
    "width": 0.25, // covers 25% of image width
    "height": 0.2, // covers 20% of image height
    "imageIndex": 0
  }
}

GUIDELINES for accurate bbox:
- If issue is in LEFT third of image: x should be 0.0-0.33
- If issue is in CENTER: x should be 0.33-0.66
- If issue is in RIGHT third: x should be 0.66-1.0
- If issue is in TOP third: y should be 0.0-0.33
- If issue is in MIDDLE: y should be 0.33-0.66
- If issue is in BOTTOM third: y should be 0.66-1.0
- Make width/height large enough to encompass the entire issue area (typically 0.15-0.35)

AVAILABLE SERVICES - Use EXACT names from this list for suggested_services:
${serviceList}
CRITICAL INSTRUCTIONS for suggested_services:
1. Use the EXACT service name as shown above (copy-paste the full name)
2. Pick the SPECIFIC variant that matches the item's needs:
   - For sneakers with multiple materials → use "Multi-Material" variant
   - For basic cleaning → use "Cleaning + Touch-ups" variant
   - For deep cleaning/restoration → use appropriate restoration service
3. Recommend MINIMUM services needed - most items need just 1-2 services
4. Match services to the detected issues

Be specific about issues and their locations. If unclear, set confidence lower.`
}

/**
 * Training pattern format for statistical few-shot learning
 */
interface TrainingPattern {
  category: string
  material: string
  issue: string
  service: string
  count: number
}

/**
 * Build statistical patterns from aggregated training data
 */
function buildStatisticalPatterns(patterns: TrainingPattern[]): string {
  if (!patterns || patterns.length === 0) return ''

  const totalVerifications = patterns.reduce((sum, p) => sum + p.count, 0)

  const patternLines = patterns.map(p => {
    return `• ${p.issue} on ${p.category} (${p.material}) → ${p.service} (verified ${p.count}x)`
  })

  return `\n\nLEARNED PATTERNS from ${totalVerifications} past corrections:
${patternLines.join('\n')}

Use these patterns to guide your service recommendations. Higher counts = more reliable patterns.`
}

/**
 * Builds the messages array for the OpenAI API call.
 *
 * @param imageUrls - Array of image URLs (multiple angles of same item)
 * @param services - Shopify services to include in the prompt
 * @param trainingPatterns - Optional training patterns for statistical few-shot learning
 * @returns Messages array ready for OpenAI chat completion
 */
export function buildAnalysisMessages(
  imageUrls: string[],
  services: ShopifyService[],
  trainingPatterns?: TrainingPattern[]
) {
  const patternsSection = buildStatisticalPatterns(trainingPatterns || [])
  const userPrompt = buildUserPrompt(services, imageUrls.length) + patternsSection

  // Build content array with text prompt and all images
  const contentArray: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'high' } }
  > = [
    {
      type: 'text' as const,
      text: userPrompt,
    },
  ]

  // Add all images
  for (const url of imageUrls) {
    contentArray.push({
      type: 'image_url' as const,
      image_url: {
        url,
        detail: 'high' as const,
      },
    })
  }

  return [
    {
      role: 'system' as const,
      content: ANALYSIS_SYSTEM_PROMPT,
    },
    {
      role: 'user' as const,
      content: contentArray,
    },
  ]
}
