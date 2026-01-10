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

Common services ISF offers:
- Full Restoration
- Deep Cleaning
- Sole Replacement
- Heel Replacement
- Color Restoration
- Stain Removal
- Scratch Repair
- Leather Conditioning
- Zipper Repair
- Hardware Polishing
- Re-stitching
- Stretching
- Waterproofing

Be specific about issues. If the image is unclear, set confidence lower. If you cannot identify something, make your best assessment and note uncertainty.`

/**
 * Builds the messages array for the OpenAI API call.
 *
 * @param imageUrl - Public URL of the image to analyze
 * @returns Messages array ready for OpenAI chat completion
 */
export function buildAnalysisMessages(imageUrl: string) {
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
          text: ANALYSIS_USER_PROMPT,
        },
        {
          type: 'image_url' as const,
          image_url: {
            url: imageUrl,
            detail: 'high' as const, // Use high detail for better analysis
          },
        },
      ],
    },
  ]
}
