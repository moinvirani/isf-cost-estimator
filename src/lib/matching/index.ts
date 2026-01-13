/**
 * Matching Utilities
 *
 * Functions for matching customers between Zoko and Shopify
 * by phone number and name.
 */

/**
 * Normalize phone number for comparison
 * Strips all non-digit characters, handles UAE formats
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return ''

  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '')

  // Remove leading zeros
  normalized = normalized.replace(/^0+/, '')

  // Remove country code 971 if present at start
  if (normalized.startsWith('971')) {
    normalized = normalized.slice(3)
  }

  return normalized
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length

  // Create distance matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  // Fill in the rest
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        )
      }
    }
  }

  return dp[m][n]
}

/**
 * Calculate similarity percentage between two strings
 * Returns 0-100
 */
function stringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100
  if (!str1 || !str2) return 0

  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 100

  const distance = levenshteinDistance(str1, str2)
  return Math.round((1 - distance / maxLen) * 100)
}

/**
 * Normalize name for comparison
 * Lowercases, removes extra spaces, handles common variations
 */
function normalizeName(name: string | null | undefined): string {
  if (!name) return ''

  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[^\w\s]/g, '') // Remove punctuation
}

/**
 * Fuzzy match between Zoko name and Shopify customer name
 *
 * @param zokoName - Single name field from Zoko (e.g., "John Smith")
 * @param shopifyFirstName - First name from Shopify
 * @param shopifyLastName - Last name from Shopify
 * @returns Confidence score 0-100
 */
export function fuzzyNameMatch(
  zokoName: string | null | undefined,
  shopifyFirstName: string | null | undefined,
  shopifyLastName: string | null | undefined
): number {
  const normalizedZoko = normalizeName(zokoName)

  // Build Shopify full name
  const shopifyParts = [shopifyFirstName, shopifyLastName]
    .filter(Boolean)
    .map(s => normalizeName(s))

  const shopifyFull = shopifyParts.join(' ')

  if (!normalizedZoko || !shopifyFull) return 0

  // Try direct full name match
  const fullMatchScore = stringSimilarity(normalizedZoko, shopifyFull)

  // Try reversed order (lastName firstName)
  const shopifyReversed = shopifyParts.reverse().join(' ')
  const reversedScore = stringSimilarity(normalizedZoko, shopifyReversed)

  // Try first name only (sometimes Zoko only has first name)
  const firstNameOnly = normalizeName(shopifyFirstName)
  const firstNameScore = firstNameOnly
    ? stringSimilarity(normalizedZoko, firstNameOnly)
    : 0

  // Return best match
  return Math.max(fullMatchScore, reversedScore, firstNameScore)
}

/**
 * Check if phone numbers match after normalization
 */
export function phonesMatch(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  const norm1 = normalizePhone(phone1)
  const norm2 = normalizePhone(phone2)

  if (!norm1 || !norm2) return false

  // Check if one contains the other (handles partial matches)
  return norm1 === norm2 || norm1.endsWith(norm2) || norm2.endsWith(norm1)
}

/**
 * Calculate overall match confidence between Zoko and Shopify customer
 *
 * @returns Object with phoneMatch (boolean), nameScore (0-100), and overall confidence
 */
export function calculateMatchConfidence(
  zokoPhone: string | null | undefined,
  zokoName: string | null | undefined,
  shopifyPhone: string | null | undefined,
  shopifyFirstName: string | null | undefined,
  shopifyLastName: string | null | undefined
): {
  phoneMatch: boolean
  nameScore: number
  confidence: 'high' | 'medium' | 'low' | 'none'
} {
  const phoneMatch = phonesMatch(zokoPhone, shopifyPhone)
  const nameScore = fuzzyNameMatch(zokoName, shopifyFirstName, shopifyLastName)

  let confidence: 'high' | 'medium' | 'low' | 'none'

  if (phoneMatch && nameScore >= 70) {
    confidence = 'high'
  } else if (phoneMatch && nameScore >= 50) {
    confidence = 'medium'
  } else if (phoneMatch) {
    confidence = 'low'
  } else {
    confidence = 'none'
  }

  return { phoneMatch, nameScore, confidence }
}
