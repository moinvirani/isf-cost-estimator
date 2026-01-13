/**
 * Shopify Service Products
 *
 * Fetches repair service products from Shopify.
 * Services are identified by the "Repair" tag.
 *
 * Category tags used by ISF:
 * - "Men's Repair" → men's shoes
 * - "Women's Repair" → women's shoes
 * - "Sneaker Repair" → sneakers
 * - "bag repair" → bags
 */

import { shopifyAdminFetch } from './client'
import type { ShopifyService } from '@/types/service'

// GraphQL query to fetch service products with ALL variants
const SERVICES_QUERY = `
  query GetServiceProducts($first: Int!, $query: String!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          description
          tags
          status
          variants(first: 20) {
            edges {
              node {
                id
                title
                price
              }
            }
          }
        }
      }
    }
  }
`

// Type for the raw Shopify GraphQL response
interface ShopifyProductsResponse {
  products: {
    edges: Array<{
      node: {
        id: string
        title: string
        description: string | null
        tags: string[]
        status: string
        variants: {
          edges: Array<{
            node: {
              id: string
              title: string  // Variant title (e.g., "Basic", "Premium")
              price: string
            }
          }>
        }
      }
    }>
  }
}

/**
 * Map Shopify tags to our internal category system
 */
function extractCategory(tags: string[]): string | undefined {
  const lowerTags = tags.map((t) => t.toLowerCase())

  // Check for specific category tags
  if (lowerTags.includes("men's repair")) return 'mens_shoes'
  if (lowerTags.includes("women's repair")) return 'womens_shoes'
  if (lowerTags.includes('sneaker repair')) return 'sneakers'
  if (lowerTags.includes('bag repair')) return 'bags'

  // If only has "Repair" tag, it's a general service
  return undefined
}

/**
 * Fetch all repair service products from Shopify
 *
 * Services are identified by the "Repair" tag in Shopify.
 * Only active products are returned.
 *
 * Products with multiple variants create separate entries:
 * - "Men's Shoe Shine" with variants "Basic", "Premium" becomes:
 *   - "Men's Shoe Shine - Basic" (AED 75)
 *   - "Men's Shoe Shine - Premium" (AED 150)
 */
export async function fetchShopifyServices(): Promise<ShopifyService[]> {
  const data = await shopifyAdminFetch<ShopifyProductsResponse>(SERVICES_QUERY, {
    first: 100,
    query: 'tag:Repair status:active',
  })

  // Transform Shopify products into our ShopifyService type
  // Each variant becomes a separate service entry
  const services: ShopifyService[] = []

  for (const { node } of data.products.edges) {
    const variants = node.variants.edges

    for (const { node: variant } of variants) {
      // If there's only one variant with "Default Title", use product title as-is
      // Otherwise, append variant title to product title
      const hasMultipleVariants = variants.length > 1
      const isDefaultVariant = variant.title === 'Default Title'

      const title = hasMultipleVariants && !isDefaultVariant
        ? `${node.title} - ${variant.title}`
        : node.title

      services.push({
        id: node.id,
        variant_id: variant.id,
        title,
        description: node.description || undefined,
        price: parseFloat(variant.price || '0'),
        currency: 'AED',
        category: extractCategory(node.tags),
        tags: node.tags,
        estimated_days: undefined,
        is_active: node.status === 'ACTIVE',
      })
    }
  }

  // Sort by title for easier browsing
  services.sort((a, b) => a.title.localeCompare(b.title))

  return services
}

/**
 * Group services by category for easier display
 */
export function groupServicesByCategory(
  services: ShopifyService[]
): Record<string, ShopifyService[]> {
  return services.reduce(
    (acc, service) => {
      const category = service.category || 'general'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(service)
      return acc
    },
    {} as Record<string, ShopifyService[]>
  )
}

/**
 * Map AI analysis output to Shopify service categories
 *
 * AI outputs:
 * - category: 'shoes' | 'bags' | 'other_leather'
 * - sub_type: 'mens' | 'womens' | 'kids' | 'unisex' (for shoes)
 *
 * Shopify categories:
 * - 'mens_shoes' (Men's Repair tag)
 * - 'womens_shoes' (Women's Repair tag)
 * - 'sneakers' (Sneaker Repair tag)
 * - 'bags' (bag repair tag)
 */
export function mapAIToShopifyCategory(
  aiCategory?: string,
  aiSubType?: string
): string[] {
  const categories: string[] = []

  if (aiCategory === 'shoes') {
    // Check sub_type to determine men's or women's
    if (aiSubType === 'mens') {
      categories.push('mens_shoes')
    } else if (aiSubType === 'womens') {
      categories.push('womens_shoes')
    } else if (aiSubType === 'kids') {
      // Kids could be either, show both
      categories.push('mens_shoes', 'womens_shoes')
    } else {
      // Unisex or unknown - show both men's and women's
      categories.push('mens_shoes', 'womens_shoes')
    }
    // Sneakers could be any shoe type
    categories.push('sneakers')
  } else if (aiCategory === 'bags') {
    categories.push('bags')
  } else if (aiCategory === 'other_leather') {
    // Other leather goods - show bag services as closest match
    categories.push('bags')
  }

  return categories
}

/**
 * Find services that match an item based on AI analysis
 * Used to filter relevant services for each item
 */
export function filterServicesForItem(
  services: ShopifyService[],
  aiCategory?: string,
  aiSubType?: string
): ShopifyService[] {
  const matchingCategories = mapAIToShopifyCategory(aiCategory, aiSubType)

  return services.filter((service) => {
    // Services with no category (general) apply to all items
    if (!service.category) return true

    // Check if service category matches any of the item's categories
    return matchingCategories.includes(service.category)
  })
}

/**
 * @deprecated Use filterServicesForItem instead
 */
export function filterServicesForCategory(
  services: ShopifyService[],
  itemCategory: string
): ShopifyService[] {
  return filterServicesForItem(services, itemCategory)
}
