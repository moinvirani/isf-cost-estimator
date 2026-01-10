/**
 * Shopify Admin API Client
 *
 * Connects to Shopify's Admin API to:
 * - Fetch repair service products (tagged "Repair")
 * - Create draft orders for customers
 */

// Environment variables for Shopify connection
const RAW_SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || ''
const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN

// Clean up domain - remove https://, trailing slashes
const SHOPIFY_STORE_DOMAIN = RAW_SHOPIFY_STORE_DOMAIN
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '')

// Shopify Admin API version (use latest stable)
const API_VERSION = '2024-01'

/**
 * Make a request to Shopify Admin GraphQL API
 */
export async function shopifyAdminFetch<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  // Validate environment variables
  if (!SHOPIFY_STORE_DOMAIN) {
    throw new Error('SHOPIFY_STORE_DOMAIN is not configured')
  }
  if (!SHOPIFY_ADMIN_ACCESS_TOKEN) {
    throw new Error('SHOPIFY_ADMIN_ACCESS_TOKEN is not configured')
  }

  const endpoint = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
  }

  const json = await response.json()

  // Check for GraphQL errors
  if (json.errors) {
    const errorMessages = json.errors.map((e: { message: string }) => e.message).join(', ')
    throw new Error(`Shopify GraphQL error: ${errorMessages}`)
  }

  return json.data as T
}

/**
 * Check if Shopify is properly configured
 */
export function isShopifyConfigured(): boolean {
  return Boolean(SHOPIFY_STORE_DOMAIN && SHOPIFY_ADMIN_ACCESS_TOKEN)
}
