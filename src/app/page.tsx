'use client'

/**
 * ISF Cost Estimator - Main Page
 *
 * This is the main workflow page where staff:
 * 1. Upload customer photos (multiple angles of same item)
 * 2. Review AI analysis
 * 3. Select services
 * 4. Add more items if needed
 * 5. Generate draft order for all items
 */

import { useState, useEffect } from 'react'
import { ImageUpload, ServiceSelector, PriceSummary, CustomerForm, OrderSuccess } from '@/components/estimation'
import type { CustomerInfo } from '@/components/estimation'
import { AnnotatedImageViewer } from '@/components/ui/annotated-image-viewer'
import { uploadImages } from '@/lib/supabase/storage'
import { calculatePrices } from '@/lib/pricing'
import { filterServicesForItem } from '@/lib/shopify'
import { generateCustomerMessage } from '@/lib/estimation/message-template'
import type { AIAnalysisResult } from '@/types/item'
import type { ShopifyService } from '@/types/service'

// Order result from draft order creation
interface OrderResult {
  draftOrderId: string
  invoiceUrl: string
  totalPrice: string
  customerMessage: string
}

// Helper to format category for display
function formatCategory(category?: string, subType?: string): string {
  if (!category) return 'Item'

  const categoryLabels: Record<string, string> = {
    shoes: 'Shoes',
    bags: 'Bag',
    other_leather: 'Leather Item',
  }

  const subTypeLabels: Record<string, string> = {
    mens: "Men's",
    womens: "Women's",
    kids: "Kids'",
    unisex: 'Unisex',
    sneakers: 'Sneakers',
    handbag: 'Handbag',
    clutch: 'Clutch',
    backpack: 'Backpack',
    wallet: 'Wallet',
    briefcase: 'Briefcase',
    tote: 'Tote',
    belt: 'Belt',
    jacket: 'Jacket',
    watch_strap: 'Watch Strap',
    other: 'Other',
  }

  const cat = categoryLabels[category] || category
  const sub = subType ? (subTypeLabels[subType] || subType) : ''

  return sub ? `${sub} ${cat}` : cat
}

// Helper to format material for display
function formatMaterial(material?: string): string {
  if (!material) return ''

  const labels: Record<string, string> = {
    smooth_leather: 'Smooth Leather',
    suede: 'Suede',
    nubuck: 'Nubuck',
    patent: 'Patent Leather',
    exotic: 'Exotic Leather',
    fabric: 'Fabric',
    synthetic: 'Synthetic',
    mixed: 'Mixed Materials',
  }
  return labels[material] || material
}

// Type for our uploaded images (before Supabase upload)
interface LocalImage {
  id: string
  file?: File
  previewUrl: string
  sourceUrl?: string
}

// Selected service with quantity
interface SelectedService {
  service: ShopifyService
  quantity: number
  aiSuggested: boolean
}

// Image after upload
interface UploadedImage {
  id: string
  url: string
  path: string
}

// A single item in the estimation (can have multiple images)
interface EstimationItem {
  id: string
  images: UploadedImage[]
  analysis: AIAnalysisResult | null
  isAnalyzing: boolean
  analysisError: string | null
  selectedServices: SelectedService[]
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9)

export default function Home() {
  // Multi-item state
  const [items, setItems] = useState<EstimationItem[]>([])
  const [currentItemIndex, setCurrentItemIndex] = useState(0)

  // Current upload batch (before creating an item)
  const [localImages, setLocalImages] = useState<LocalImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Shopify services state
  const [shopifyServices, setShopifyServices] = useState<ShopifyService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState<string | null>(null)

  // Draft order state
  const [isGeneratingOrder, setIsGeneratingOrder] = useState(false)
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)

  // Get current item
  const currentItem = items[currentItemIndex]

  // Fetch Shopify services on mount
  useEffect(() => {
    async function fetchServices() {
      try {
        const response = await fetch('/api/services')
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch services')
        }

        setShopifyServices(data.services)
      } catch (error) {
        console.error('Error fetching services:', error)
        setServicesError(
          error instanceof Error ? error.message : 'Failed to load services'
        )
      } finally {
        setServicesLoading(false)
      }
    }

    fetchServices()
  }, [])

  // Handle image selection (local preview)
  const handleImagesChange = (images: LocalImage[]) => {
    setLocalImages(images)
    setUploadError(null)
  }

  // Handle upload to Supabase and create new item
  const handleUpload = async () => {
    if (localImages.length === 0) return

    setIsUploading(true)
    setUploadError(null)

    try {
      // Separate file-based and URL-based images
      const fileImages = localImages.filter(img => img.file)
      const urlImages = localImages.filter(img => img.sourceUrl && !img.file)

      const uploaded: UploadedImage[] = []

      // Upload file-based images to Supabase Storage
      if (fileImages.length > 0) {
        const files = fileImages.map(img => img.file!)
        const results = await uploadImages(files)

        for (let i = 0; i < results.length; i++) {
          uploaded.push({
            id: fileImages[i].id,
            url: results[i].url,
            path: results[i].path,
          })
        }
      }

      // Add URL-based images directly (no upload needed)
      for (const img of urlImages) {
        uploaded.push({
          id: img.id,
          url: img.sourceUrl!,
          path: `url:${img.sourceUrl}`,
        })
      }

      // Create new item with uploaded images
      const newItem: EstimationItem = {
        id: generateId(),
        images: uploaded,
        analysis: null,
        isAnalyzing: false,
        analysisError: null,
        selectedServices: [],
      }

      setItems(prev => [...prev, newItem])
      setCurrentItemIndex(items.length) // Switch to the new item
      setLocalImages([]) // Clear local images

      console.log('Upload successful, created item:', newItem)
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadError(
        error instanceof Error ? error.message : 'Upload failed. Please try again.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  // Analyze current item's images
  const handleAnalyze = async () => {
    if (!currentItem || currentItem.images.length === 0) return

    // Set analyzing state
    setItems(prev =>
      prev.map((item, idx) =>
        idx === currentItemIndex
          ? { ...item, isAnalyzing: true, analysisError: null }
          : item
      )
    )

    try {
      const imageUrls = currentItem.images.map(img => img.url)

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      const analysis: AIAnalysisResult = data.analysis

      // Find matching services for AI suggestions
      const autoSelectedServices = findMatchingServices(
        analysis.suggested_services,
        analysis.category,
        analysis.sub_type
      )

      // Update item with analysis
      setItems(prev =>
        prev.map((item, idx) =>
          idx === currentItemIndex
            ? {
                ...item,
                analysis,
                isAnalyzing: false,
                selectedServices: autoSelectedServices,
              }
            : item
        )
      )
    } catch (error) {
      console.error('Analysis error:', error)
      setItems(prev =>
        prev.map((item, idx) =>
          idx === currentItemIndex
            ? {
                ...item,
                isAnalyzing: false,
                analysisError: error instanceof Error ? error.message : 'Analysis failed',
              }
            : item
        )
      )
    }
  }

  // Retry analysis for current item
  const handleRetryAnalysis = () => {
    setItems(prev =>
      prev.map((item, idx) =>
        idx === currentItemIndex
          ? { ...item, analysis: null, analysisError: null, selectedServices: [] }
          : item
      )
    )
  }

  // Update services for current item
  const handleServiceSelectionChange = (selectedServices: SelectedService[]) => {
    setItems(prev =>
      prev.map((item, idx) =>
        idx === currentItemIndex ? { ...item, selectedServices } : item
      )
    )
  }

  // Find matching Shopify services for AI suggestions
  const findMatchingServices = (
    suggestedNames: string[],
    category?: string,
    subType?: string
  ): SelectedService[] => {
    const relevantServices = filterServicesForItem(shopifyServices, category, subType)

    return suggestedNames
      .map(suggestedName => {
        let match = relevantServices.find(s =>
          s.title.toLowerCase() === suggestedName.toLowerCase()
        )

        if (!match) {
          match = relevantServices.find(s =>
            s.title.toLowerCase().includes(suggestedName.toLowerCase()) ||
            suggestedName.toLowerCase().includes(s.title.toLowerCase())
          )
        }

        return match
      })
      .filter((s): s is ShopifyService => s !== undefined)
      .map(service => ({
        service,
        quantity: 1,
        aiSuggested: true,
      }))
  }

  // Add another item - reset for new upload
  const handleAddAnotherItem = () => {
    setLocalImages([])
    setUploadError(null)
    // Don't change currentItemIndex yet - it will update when new item is created
  }

  // Switch to editing a specific item
  const handleEditItem = (index: number) => {
    setCurrentItemIndex(index)
  }

  // Remove an item
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index))
    // Adjust current index if needed
    if (currentItemIndex >= index && currentItemIndex > 0) {
      setCurrentItemIndex(prev => prev - 1)
    }
  }

  // Calculate total price for ALL items
  const calculateTotalPrices = () => {
    // Aggregate all items' price calculations
    const allResults = items
      .filter(item => item.analysis && item.selectedServices.length > 0)
      .map(item => calculatePrices(
        item.selectedServices,
        item.analysis!.material,
        item.analysis!.condition
      ))

    // Merge all line items
    const allLineItems = allResults.flatMap(r => r.lineItems)
    const totalSubtotal = allResults.reduce((sum, r) => sum + r.subtotal, 0)
    const totalModifiers = allResults.reduce((sum, r) => sum + r.modifiersTotal, 0)

    return {
      lineItems: allLineItems,
      subtotal: totalSubtotal,
      modifiersTotal: totalModifiers,
      grandTotal: totalSubtotal + totalModifiers,
      currency: 'AED',
    }
  }

  // Check various states
  const hasLocalImages = localImages.length > 0
  const hasItems = items.length > 0
  const currentItemAnalyzed = currentItem?.analysis !== null
  const currentItemHasServices = (currentItem?.selectedServices.length || 0) > 0
  const anyItemHasServices = items.some(item => item.selectedServices.length > 0)
  const allItemsComplete = items.length > 0 && items.every(item =>
    item.analysis !== null && item.selectedServices.length > 0
  )

  const priceCalculation = calculateTotalPrices()

  // Handle draft order creation
  const handleGenerateOrder = async (customerInfo: CustomerInfo) => {
    setIsGeneratingOrder(true)
    setOrderError(null)

    try {
      // Save training data for each item
      for (const item of items) {
        if (item.analysis && item.selectedServices.length > 0) {
          try {
            await fetch('/api/training/examples', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image_url: item.images[0]?.url,
                ai_category: item.analysis.category,
                ai_sub_type: item.analysis.sub_type,
                ai_material: item.analysis.material,
                ai_condition: item.analysis.condition,
                ai_issues: item.analysis.issues || [],
                ai_suggested_services: item.analysis.suggested_services,
                correct_services: item.selectedServices.map(s => ({
                  service_name: s.service.title,
                  variant_id: s.service.variant_id,
                  quantity: s.quantity,
                })),
                status: 'verified',
              }),
            })
          } catch (error) {
            console.error('Failed to save training example:', error)
          }
        }
      }

      // Build line items for API
      const lineItems = priceCalculation.lineItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }))

      // Create draft order
      const response = await fetch('/api/shopify/draft-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: customerInfo,
          lineItems,
          note: `Created via ISF Cost Estimator for ${items.length} item(s)`,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create draft order')
      }

      // Generate customer message
      const message = generateCustomerMessage({
        customerName: customerInfo.name,
        items: priceCalculation.lineItems.map(item => ({
          name: item.serviceName,
          quantity: item.quantity,
          price: item.basePrice,
        })),
        totalPrice: priceCalculation.grandTotal,
        checkoutUrl: data.invoiceUrl,
        currency: 'AED',
      })

      setOrderResult({
        draftOrderId: data.draftOrderId,
        invoiceUrl: data.invoiceUrl,
        totalPrice: data.totalPrice,
        customerMessage: message,
      })
    } catch (error) {
      console.error('Order creation error:', error)
      setOrderError(error instanceof Error ? error.message : 'Failed to create order')
    } finally {
      setIsGeneratingOrder(false)
    }
  }

  // Reset to start new estimation
  const handleStartNew = () => {
    setItems([])
    setCurrentItemIndex(0)
    setLocalImages([])
    setOrderResult(null)
    setOrderError(null)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-900">
            ISF Cost Estimator
          </h1>
          <p className="text-sm text-gray-500">
            Upload photos to get service recommendations
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className={`max-w-3xl mx-auto px-4 py-6 space-y-6 ${anyItemHasServices && !orderResult ? 'pb-28' : ''}`}>

        {/* Items Summary (when we have items) */}
        {hasItems && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">
              Items ({items.length})
            </h2>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${idx === currentItemIndex
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                    }
                  `}
                  onClick={() => handleEditItem(idx)}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.images[0] && (
                      <img
                        src={item.images[0].url}
                        alt={`Item ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">
                      {item.analysis
                        ? formatCategory(item.analysis.category, item.analysis.sub_type)
                        : `Item ${idx + 1}`}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.images.length} image{item.images.length !== 1 ? 's' : ''}
                      {item.selectedServices.length > 0 && (
                        <span> • {item.selectedServices.length} service{item.selectedServices.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>

                  {/* Status indicator */}
                  <div className="flex-shrink-0">
                    {item.isAnalyzing ? (
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : item.analysis && item.selectedServices.length > 0 ? (
                      <span className="text-green-600 text-lg">✓</span>
                    ) : item.analysis ? (
                      <span className="text-yellow-600 text-sm">Select services</span>
                    ) : (
                      <span className="text-gray-400 text-sm">Needs analysis</span>
                    )}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveItem(idx)
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove item"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add Another Item button */}
            {allItemsComplete && (
              <button
                onClick={handleAddAnotherItem}
                className="mt-3 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 font-medium hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Another Item
              </button>
            )}
          </section>
        )}

        {/* Step 1: Upload Images (show when no current item or adding new) */}
        {(!currentItem || (allItemsComplete && localImages.length === 0)) && !orderResult && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {hasItems ? 'Add Another Item' : 'Step 1: Upload Photos'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Upload multiple photos of the same item (different angles)
            </p>

            <ImageUpload
              onImagesChange={handleImagesChange}
              maxImages={10}
            />

            {/* Upload Button */}
            {hasLocalImages && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className={`
                    flex-1 py-3 px-4 rounded-lg font-medium text-white
                    transition-colors
                    ${isUploading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                    }
                  `}
                >
                  {isUploading ? 'Uploading...' : `Upload ${localImages.length} Image${localImages.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}

            {/* Upload Error */}
            {uploadError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {uploadError}
              </div>
            )}
          </section>
        )}

        {/* Step 2: AI Analysis (for current item) */}
        {currentItem && !currentItem.analysis && !orderResult && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                Step 2: AI Analysis
              </h2>

              {!currentItem.isAnalyzing && !currentItem.analysisError && (
                <button
                  onClick={handleAnalyze}
                  className="px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Analyze {currentItem.images.length} Image{currentItem.images.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>

            {/* Image thumbnails */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {currentItem.images.map((image, idx) => (
                <div
                  key={image.id}
                  className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200"
                >
                  <img
                    src={image.url}
                    alt={`Angle ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {currentItem.isAnalyzing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
                    {idx + 1}
                  </span>
                </div>
              ))}
            </div>

            {/* Analyzing state */}
            {currentItem.isAnalyzing && (
              <p className="text-sm text-gray-500 text-center">
                Analyzing images...
              </p>
            )}

            {/* Error state */}
            {currentItem.analysisError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-sm">{currentItem.analysisError}</p>
                <button
                  onClick={handleRetryAnalysis}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Retry Analysis
                </button>
              </div>
            )}
          </section>
        )}

        {/* Step 3: Service Selection (for current item with analysis) */}
        {currentItem?.analysis && !orderResult && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Step 3: Select Services for Item {currentItemIndex + 1}
            </h2>

            {/* Image viewer */}
            <div className="mb-4">
              <AnnotatedImageViewer
                images={currentItem.images.map(img => ({ id: img.id, url: img.url }))}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Tap an image to view full-screen with zoom
              </p>
            </div>

            {/* Analysis summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900">
                  {formatCategory(currentItem.analysis.category, currentItem.analysis.sub_type)}
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-600">
                  {formatMaterial(currentItem.analysis.material)}
                </span>
                {currentItem.analysis.brand && (
                  <>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-600">{currentItem.analysis.brand}</span>
                  </>
                )}
              </div>

              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${
                  currentItem.analysis.condition === 'excellent' ? 'bg-green-100 text-green-800' :
                  currentItem.analysis.condition === 'good' ? 'bg-blue-100 text-blue-800' :
                  currentItem.analysis.condition === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {currentItem.analysis.condition} condition
                </span>
              </div>

              {currentItem.analysis.issues.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    Detected Issues ({currentItem.analysis.issues.length})
                  </p>
                  <div className="space-y-1">
                    {currentItem.analysis.issues.map((issue, i) => (
                      <div key={i} className="text-sm flex items-center gap-2">
                        <span className="font-medium text-gray-800 capitalize">
                          {issue.type.replace(/_/g, ' ')}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          issue.severity === 'minor' ? 'bg-yellow-100 text-yellow-800' :
                          issue.severity === 'moderate' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {issue.severity}
                        </span>
                        <span className="text-gray-500 text-xs">
                          ({issue.location.replace(/_/g, ' ')})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Service selector */}
            {servicesLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 mt-2">Loading services...</p>
              </div>
            ) : servicesError ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {servicesError}
              </div>
            ) : (
              <ServiceSelector
                services={shopifyServices}
                suggestedServiceNames={currentItem.analysis.suggested_services || []}
                selectedServices={currentItem.selectedServices}
                onSelectionChange={handleServiceSelectionChange}
                itemCategory={currentItem.analysis.category}
                itemSubType={currentItem.analysis.sub_type}
              />
            )}

            {/* Add Another Item button (after selecting services) */}
            {currentItemHasServices && (
              <button
                onClick={handleAddAnotherItem}
                className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 font-medium hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Another Item
              </button>
            )}
          </section>
        )}

        {/* Step 4: Review & Generate Order */}
        {anyItemHasServices && !orderResult && (
          <section id="step-4-order" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 scroll-mt-20">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Step 4: Review & Generate Order
            </h2>

            {/* Price summary for all items */}
            <PriceSummary
              lineItems={priceCalculation.lineItems}
              subtotal={priceCalculation.subtotal}
              modifiersTotal={priceCalculation.modifiersTotal}
              grandTotal={priceCalculation.grandTotal}
              currency={priceCalculation.currency}
            />

            {/* Customer form */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4">Customer Information</h3>
              <CustomerForm
                onSubmit={handleGenerateOrder}
                isLoading={isGeneratingOrder}
              />
            </div>

            {/* Error message */}
            {orderError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {orderError}
              </div>
            )}
          </section>
        )}

        {/* Order Success */}
        {orderResult && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <OrderSuccess
              invoiceUrl={orderResult.invoiceUrl}
              totalPrice={orderResult.totalPrice}
              customerMessage={orderResult.customerMessage}
              onStartNew={handleStartNew}
            />
          </section>
        )}
      </div>

      {/* Sticky Footer */}
      {anyItemHasServices && !orderResult && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Total price */}
              <div>
                <p className="text-sm text-gray-500">
                  {items.length} item{items.length !== 1 ? 's' : ''} • Total
                </p>
                <p className="text-xl font-bold text-gray-900">
                  AED {priceCalculation.grandTotal.toFixed(2)}
                </p>
              </div>

              {/* Generate Order button */}
              <button
                onClick={() => {
                  const step4 = document.getElementById('step-4-order')
                  step4?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="flex-1 max-w-xs h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>Generate Order</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
