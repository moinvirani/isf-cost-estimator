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
 * Updated to detect multiple distinct items across images.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are an expert leather goods assessor working for Italian Shoe Factory (ISF), a premium shoe and leather repair service in Dubai.

You will receive one or more images. They may show:
- The SAME item from different angles (group together)
- DIFFERENT items that need SEPARATE analysis

Your job is to:
1. Identify how many DISTINCT items are shown across all images
2. Group images that show the SAME item together (by imageIndices)
3. Provide SEPARATE analysis for EACH distinct item
4. For each item: identify type, material, condition, brand, issues, and recommended services

IMPORTANT:
- If images show different products (e.g., shoe in image 0, bag in image 1), return SEPARATE analyses
- If images show same product from different angles, group them under ONE analysis with multiple imageIndices
- Look for visual cues: same color, same style, same brand, same damage patterns = likely same item

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
    ? `\nYou are analyzing ${imageCount} images (indexed 0 to ${imageCount - 1}). Determine if they show SAME or DIFFERENT items.`
    : '\nYou are analyzing 1 image (imageIndex: 0). Return one item in the items array.'

  return `Analyze ${imageCount > 1 ? 'these images' : 'this image'} and provide assessment for EACH distinct item found.
${imageIndexNote}

Respond with ONLY valid JSON in this exact structure:

{
  "items": [
    {
      "imageIndices": [0, 1],  // Which images (by index) show THIS item - REQUIRED
      "category": "shoes" | "bags" | "other_leather",
      "sub_type": "<specific type - for shoes: 'mens', 'womens', 'kids', 'unisex', 'sneakers'; for bags: 'handbag', 'clutch', 'backpack', 'wallet', 'briefcase', 'tote'; for other: 'belt', 'jacket', 'watch_strap', 'other'>",
      "material": "smooth_leather" | "suede" | "nubuck" | "patent" | "exotic" | "fabric" | "synthetic" | "mixed",
      "color": "<primary color>",
      "brand": "<brand name if visible, or null if not identifiable>",
      "condition": "excellent" | "good" | "fair" | "poor",
      "issues": [
        {
          "type": "<issue type: scuff, stain, scratch, tear, heel_damage, sole_wear, sole_discoloration, color_fade, water_damage, mold, broken_hardware, etc.>",
          "severity": "minor" | "moderate" | "severe",
          "location": "<location on item: toe_box, heel, sole, upper, strap, handle, zipper, buckle, lining, etc.>",
          "description": "<brief description>"
        }
      ],
      "suggested_services": ["<EXACT service name from the list below>"],
      "confidence": <0.0 to 1.0 - how confident you are in this analysis>,
      "notes": "<any additional observations>"
    }
  ],
  "total_items": <number of distinct items found>
}

IMPORTANT:
- If all images show the SAME item from different angles → return 1 item with imageIndices: [0, 1, 2, ...]
- If images show DIFFERENT items → return multiple items, each with their own imageIndices
- Every image index (0 to ${imageCount - 1}) must appear in exactly ONE item's imageIndices array

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
5. Look for brand-specific services when brand is identified (e.g., "Loro Piana Sole Change" for Loro Piana shoes)

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
 * Build customer context section for the prompt
 * Context is optional and supplementary - primarily used for brand identification
 */
function buildCustomerContext(contextMessages: string[]): string {
  if (!contextMessages || contextMessages.length === 0) return ''

  const messages = contextMessages
    .filter(m => m && m.trim())
    .slice(0, 5)  // Limit to 5 messages
    .map(m => `- "${m.trim()}"`)
    .join('\n')

  if (!messages) return ''

  return `

CUSTOMER CONTEXT (use for brand identification, but trust your visual analysis for service recommendations):
${messages}

HOW TO USE CUSTOMER CONTEXT:
1. Brand identification: If customer mentions a brand name (e.g., "Loro Piana", "Gucci", "Prada"), use that for the "brand" field
2. DO NOT blindly follow customer's service request - recommend the CORRECT service based on what you SEE
   - Example: Customer asks for "cleaning" but you see severe sole discoloration → recommend "Sole Change" not cleaning
3. Use your visual analysis + training patterns as primary source of truth for service recommendations
4. Look for brand-specific services when brand is identified (e.g., "Loro Piana Sole Change" for Loro Piana shoes with sole issues)`
}

/**
 * Builds the messages array for the OpenAI API call.
 *
 * @param imageUrls - Array of image URLs (multiple angles of same item)
 * @param services - Shopify services to include in the prompt
 * @param trainingPatterns - Optional training patterns for statistical few-shot learning
 * @param contextMessages - Optional customer messages for brand identification hints
 * @returns Messages array ready for OpenAI chat completion
 */
export function buildAnalysisMessages(
  imageUrls: string[],
  services: ShopifyService[],
  trainingPatterns?: TrainingPattern[],
  contextMessages?: string[]
) {
  const patternsSection = buildStatisticalPatterns(trainingPatterns || [])
  const contextSection = buildCustomerContext(contextMessages || [])
  const userPrompt = buildUserPrompt(services, imageUrls.length) + patternsSection + contextSection

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
