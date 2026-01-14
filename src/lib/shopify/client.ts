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

/**
 * Make a REST request to Shopify Admin API
 * Used for endpoints not available via GraphQL (e.g., draft orders)
 */
export async function shopifyAdminREST<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>
): Promise<T> {
  // Validate environment variables
  if (!SHOPIFY_STORE_DOMAIN) {
    throw new Error('SHOPIFY_STORE_DOMAIN is not configured')
  }
  if (!SHOPIFY_ADMIN_ACCESS_TOKEN) {
    throw new Error('SHOPIFY_ADMIN_ACCESS_TOKEN is not configured')
  }

  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/${endpoint}`

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
  }

  return response.json() as Promise<T>
}

/**
 * Create a Shopify client for REST API calls
 * Provides a simpler interface with .post(), .get() methods
 */
export function createShopifyClient() {
  return {
    async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
      return shopifyAdminREST<T>(endpoint, 'POST', body)
    },
    async get<T>(endpoint: string): Promise<T> {
      return shopifyAdminREST<T>(endpoint, 'GET')
    },
    async put<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
      return shopifyAdminREST<T>(endpoint, 'PUT', body)
    },
    async delete<T>(endpoint: string): Promise<T> {
      return shopifyAdminREST<T>(endpoint, 'DELETE')
    },
  }
}
