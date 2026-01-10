/**
 * AI Analysis Prompts
 *
 * Prompts for GPT-4 Vision to analyze shoe/bag/leather images.
 * Returns structured JSON matching our AIAnalysisResult type.
 */

/**
 * System prompt that sets context for the AI.
 * Explains the role and expected output format.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are an expert leather goods assessor working for Italian Shoe Factory (ISF), a premium shoe and leather repair service in Dubai. Your job is to analyze photos of shoes, bags, and leather goods to identify:

1. What type of item it is
2. The material it's made of
3. The current condition
4. Any issues or damage that need repair
5. What services might be needed

You must respond ONLY with valid JSON matching the exact structure specified. Do not include any text before or after the JSON.`

/**
 * User prompt template for analyzing a single image.
 * This gets sent along with the image.
 */
export const ANALYSIS_USER_PROMPT = `Analyze this image and provide a detailed assessment. Respond with ONLY valid JSON in this exact structure:

{
  "category": "shoes" | "bags" | "other_leather",
  "sub_type": "<specific type - for shoes: 'mens', 'womens', 'kids', 'unisex'; for bags: 'handbag', 'clutch', 'backpack', 'wallet', 'briefcase', 'tote'; for other: 'belt', 'jacket', 'watch_strap', 'other'>",
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
  "suggested_services": ["<service names that would address the issues>"],
  "confidence": <0.0 to 1.0 - how confident you are in this analysis>,
  "notes": "<any additional observations about the item>"
}

ISF Services (use EXACT names from this list):
MEN'S SHOES:
- Men's | Heel Top-Lift Replacement (AED 225)
- Men's | Resoling Services (AED 225)
- Men's | Gluing (AED 95)
- Shampoo Suede (AED 125) - for suede/nubuck cleaning
- Stitching (AED 115)

WOMEN'S SHOES:
- Women's | Glissoire (AED 225)
- Women's | Sole Protector | Vibram (AED 185)
- Women's | Resoling (AED 375)
- Shampoo Suede (AED 125) - for suede/nubuck cleaning
- Stitching (AED 115)

SNEAKERS:
- Sneaker | Spa (AED 125) - basic cleaning
- Sneaker | Color Restoration (AED 275)
- Sneaker | Full Rubber Resoling (AED 650)

BAGS:
- Bags I Cleaning & Refresh (AED 125)
- Bags | Zipper Repair (AED 175)
- Bags | Lining Repair/Change (AED 375)
- Bags | Gold Plating (AED 215)
- Bags | Color Restoration (AED 275)

IMPORTANT: For suggested_services, recommend the MINIMUM services needed. Most items need just 1-2 services:
- Dirty suede shoe → "Shampoo Suede"
- Worn heel on men's shoe → "Men's | Heel Top-Lift Replacement"
- Scuffed sneakers → "Sneaker | Spa"
- Dirty bag → "Bags I Cleaning & Refresh"

Be specific about issues. If unclear, set confidence lower.`

/**
 * Training example format for few-shot learning
 */
interface TrainingExampleForPrompt {
  ai_category?: string
  ai_material?: string
  ai_condition?: string
  correct_services: Array<{ service_name: string }>
}

/**
 * Build few-shot examples from training data
 */
function buildFewShotExamples(examples: TrainingExampleForPrompt[]): string {
  if (!examples || examples.length === 0) return ''

  const exampleStrings = examples.slice(0, 5).map((ex, i) => {
    const services = ex.correct_services.map(s => s.service_name).join(', ')
    return `Example ${i + 1}: ${ex.ai_category || 'item'} (${ex.ai_material || 'leather'}, ${ex.ai_condition || 'fair'} condition) → Services: ${services}`
  })

  return `\n\nLEARNED EXAMPLES from past assessments:\n${exampleStrings.join('\n')}\n\nUse these examples to guide your service recommendations.`
}

/**
 * Builds the messages array for the OpenAI API call.
 *
 * @param imageUrl - Public URL of the image to analyze
 * @param trainingExamples - Optional training examples for few-shot learning
 * @returns Messages array ready for OpenAI chat completion
 */
export function buildAnalysisMessages(
  imageUrl: string,
  trainingExamples?: TrainingExampleForPrompt[]
) {
  const fewShotSection = buildFewShotExamples(trainingExamples || [])
  const enhancedPrompt = ANALYSIS_USER_PROMPT + fewShotSection

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
          text: enhancedPrompt,
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
