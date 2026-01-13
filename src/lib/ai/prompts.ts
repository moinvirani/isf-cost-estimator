/**
 * AI Analysis Prompts
 *
 * Prompts for GPT-4 Vision to analyze shoe/bag/leather images.
 * Returns structured JSON matching our AIAnalysisResult type.
 */

import type { ShopifyService } from '@/types/service'

/**
 * System prompt that sets context for the AI.
 * Explains the role and expected output format.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are an expert leather goods assessor working for Italian Shoe Factory (ISF), a premium shoe and leather repair service in Dubai. Your job is to analyze photos of shoes, bags, and leather goods to identify:

1. How many distinct items are in the image (count pairs of shoes as ONE item each)
2. What type each item is
3. The material each is made of
4. The current condition of each
5. Any issues or damage that need repair
6. What SPECIFIC services are needed for each item

IMPORTANT: A single image may contain MULTIPLE items (e.g., 4 pairs of shoes laid out together). You must identify and analyze EACH item separately.

You must respond ONLY with valid JSON matching the exact structure specified. Do not include any text before or after the JSON.`

/**
 * Build the user prompt with dynamic service list from Shopify
 */
function buildUserPrompt(services: ShopifyService[]): string {
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

  return `Analyze this image and provide a detailed assessment of ALL items visible. If multiple items (pairs of shoes, bags, etc.) are in the image, analyze EACH ONE separately.

Respond with ONLY valid JSON in this exact structure - ALWAYS return an array, even for single items:

{
  "items": [
    {
      "item_number": 1,
      "position": "<where in image: top, middle, bottom, left, right, center>",
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
          "location": "<location: toe_box, heel, sole, upper, strap, handle, zipper, buckle, lining, etc.>",
          "description": "<brief description>"
        }
      ],
      "suggested_services": ["<EXACT service name from the list below>"],
      "confidence": <0.0 to 1.0 - how confident you are in this analysis>,
      "notes": "<any additional observations about this specific item>"
    }
  ],
  "total_items": <number of items detected>
}

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

Be specific about issues. If unclear, set confidence lower.`
}

/**
 * Training pattern format for statistical few-shot learning
 * Aggregated from training data: issue + category + material → most common service
 */
interface TrainingPattern {
  category: string
  material: string
  issue: string
  service: string
  count: number  // How many times this pattern was verified
}

/**
 * Build statistical patterns from aggregated training data
 * Shows AI patterns like: "heel_damage on shoes (leather) → Rubber Heel (verified 12x)"
 */
function buildStatisticalPatterns(patterns: TrainingPattern[]): string {
  if (!patterns || patterns.length === 0) return ''

  const totalVerifications = patterns.reduce((sum, p) => sum + p.count, 0)

  const patternLines = patterns.map(p => {
    // Format: • heel_damage on shoes (smooth_leather) → Rubber Heel / Type 1 (verified 12x)
    return `• ${p.issue} on ${p.category} (${p.material}) → ${p.service} (verified ${p.count}x)`
  })

  return `\n\nLEARNED PATTERNS from ${totalVerifications} past corrections:
${patternLines.join('\n')}

Use these patterns to guide your service recommendations. Higher counts = more reliable patterns.`
}

/**
 * Builds the messages array for the OpenAI API call.
 *
 * @param imageUrl - Public URL of the image to analyze
 * @param services - Shopify services to include in the prompt
 * @param trainingPatterns - Optional training patterns for statistical few-shot learning
 * @returns Messages array ready for OpenAI chat completion
 */
export function buildAnalysisMessages(
  imageUrl: string,
  services: ShopifyService[],
  trainingPatterns?: TrainingPattern[]
) {
  const patternsSection = buildStatisticalPatterns(trainingPatterns || [])
  const userPrompt = buildUserPrompt(services) + patternsSection

  return [
    {
      role: 'system' as const,
      content: ANALYSIS_SYSTEM_PROMPT,
    },
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: userPrompt,
        },
        {
          type: 'image_url' as const,
          image_url: {
            url: imageUrl,
            detail: 'high' as const,
          },
        },
      ],
    },
  ]
}
