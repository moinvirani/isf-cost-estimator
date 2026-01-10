/**
 * Shopify Integration
 *
 * Exports all Shopify-related functions for use in the app.
 */

export { shopifyAdminFetch, isShopifyConfigured } from './client'
export {
  fetchShopifyServices,
  groupServicesByCategory,
  filterServicesForItem,
  mapAIToShopifyCategory,
  // Deprecated - use filterServicesForItem
  filterServicesForCategory,
} from './services'
