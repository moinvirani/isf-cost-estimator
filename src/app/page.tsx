'use client'

/**
 * ISF Cost Estimator - Main Page
 *
 * This is the main workflow page where staff:
 * 1. Upload customer photos
 * 2. Review AI analysis
 * 3. Select services
 * 4. Generate draft order
 */

import { useState, useEffect } from 'react'
import { ImageUpload, ItemCard, ServiceSelector, PriceSummary, CustomerForm, OrderSuccess } from '@/components/estimation'
import type { CustomerInfo } from '@/components/estimation'
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
  file?: File           // Optional - may be URL-based
  previewUrl: string
  sourceUrl?: string    // Original URL if loaded from URL
}

// Selected service with quantity
interface SelectedService {
  service: ShopifyService
  quantity: number
  aiSuggested: boolean
}

// Type for images after Supabase upload, with analysis and services
interface UploadedImage {
  id: string
  url: string
  path: string
  analysis: AIAnalysisResult | null
  isAnalyzing: boolean
  analysisError: string | null
  selectedServices: SelectedService[]
}

export default function Home() {
  // Image states
  const [localImages, setLocalImages] = useState<LocalImage[]>([])
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
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

  // Analyze a single image (may detect multiple items)
  const analyzeImage = async (imageId: string, imageUrl: string) => {
    // Set analyzing state for this image
    setUploadedImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? { ...img, isAnalyzing: true, analysisError: null }
          : img
      )
    )

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      // Check if multiple items were detected
      const items: AIAnalysisResult[] = data.items || [data.analysis]
      const totalItems = data.total_items || 1

      if (totalItems > 1) {
        // Multiple items detected - split into separate entries with auto-selected services
        setUploadedImages((prev) => {
          const imageIndex = prev.findIndex((img) => img.id === imageId)
          if (imageIndex === -1) return prev

          const originalImage = prev[imageIndex]
          const newImages: UploadedImage[] = items.map((item, idx) => ({
            id: `${imageId}-item-${idx + 1}`,
            url: originalImage.url,
            path: originalImage.path,
            analysis: item,
            isAnalyzing: false,
            analysisError: null,
            // Auto-select AI suggested services
            selectedServices: findMatchingServices(
              item.suggested_services,
              item.category,
              item.sub_type
            ),
          }))

          // Replace original with split items
          return [
            ...prev.slice(0, imageIndex),
            ...newImages,
            ...prev.slice(imageIndex + 1),
          ]
        })
      } else {
        // Single item - update with auto-selected services
        const analysis = items[0]
        const autoSelectedServices = findMatchingServices(
          analysis.suggested_services,
          analysis.category,
          analysis.sub_type
        )

        setUploadedImages((prev) =>
          prev.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  analysis,
                  isAnalyzing: false,
                  selectedServices: autoSelectedServices,
                }
              : img
          )
        )
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                isAnalyzing: false,
                analysisError:
                  error instanceof Error ? error.message : 'Analysis failed',
              }
            : img
        )
      )
    }
  }

  // Handle upload to Supabase and trigger analysis
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
            analysis: null,
            isAnalyzing: false,
            analysisError: null,
            selectedServices: [],
          })
        }
      }

      // Add URL-based images directly (no upload needed)
      for (const img of urlImages) {
        uploaded.push({
          id: img.id,
          url: img.sourceUrl!,
          path: `url:${img.sourceUrl}`,
          analysis: null,
          isAnalyzing: false,
          analysisError: null,
          selectedServices: [],
        })
      }

      setUploadedImages(uploaded)

      // Clear local images (they're now uploaded)
      setLocalImages([])

      console.log('Upload successful:', uploaded)
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadError(
        error instanceof Error ? error.message : 'Upload failed. Please try again.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  // Analyze all uploaded images
  const handleAnalyzeAll = () => {
    uploadedImages.forEach((image) => {
      if (!image.analysis && !image.isAnalyzing) {
        analyzeImage(image.id, image.url)
      }
    })
  }

  // Retry analysis for a single image
  const handleRetryAnalysis = (imageId: string) => {
    const image = uploadedImages.find((img) => img.id === imageId)
    if (image) {
      analyzeImage(image.id, image.url)
    }
  }

  // Update selected services for an item
  const handleServiceSelectionChange = (
    imageId: string,
    selectedServices: SelectedService[]
  ) => {
    setUploadedImages((prev) =>
      prev.map((img) =>
        img.id === imageId ? { ...img, selectedServices } : img
      )
    )
  }

  // Find matching Shopify services for AI suggestions (exact match on title)
  const findMatchingServices = (
    suggestedNames: string[],
    category?: string,
    subType?: string
  ): SelectedService[] => {
    const relevantServices = filterServicesForItem(shopifyServices, category, subType)

    // Try exact match first, then fuzzy match
    return suggestedNames
      .map(suggestedName => {
        // Exact match (AI should now use exact names from Shopify)
        let match = relevantServices.find(s =>
          s.title.toLowerCase() === suggestedName.toLowerCase()
        )

        // Fuzzy match as fallback (for training data / older suggestions)
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

  // Calculate total price across all items
  const calculateTotalPrices = () => {
    // Combine all selected services from all items
    const allSelectedServices = uploadedImages.flatMap((img) => {
      if (!img.analysis || img.selectedServices.length === 0) return []

      // Calculate with modifiers based on item's material/condition
      return calculatePrices(
        img.selectedServices,
        img.analysis.material,
        img.analysis.condition
      )
    })

    // If no items have services selected, return empty result
    if (allSelectedServices.length === 0) {
      return {
        lineItems: [],
        subtotal: 0,
        modifiersTotal: 0,
        grandTotal: 0,
        currency: 'AED',
      }
    }

    // Aggregate all calculations
    const allLineItems = allSelectedServices.flatMap((calc) => calc.lineItems)
    const totalSubtotal = allSelectedServices.reduce((sum, calc) => sum + calc.subtotal, 0)
    const totalModifiers = allSelectedServices.reduce((sum, calc) => sum + calc.modifiersTotal, 0)
    const totalGrand = allSelectedServices.reduce((sum, calc) => sum + calc.grandTotal, 0)

    return {
      lineItems: allLineItems,
      subtotal: totalSubtotal,
      modifiersTotal: totalModifiers,
      grandTotal: totalGrand,
      currency: 'AED',
    }
  }

  const hasLocalImages = localImages.length > 0
  const hasUploadedImages = uploadedImages.length > 0
  const hasUnanalyzedImages = uploadedImages.some(
    (img) => !img.analysis && !img.isAnalyzing && !img.analysisError
  )
  const isAnyAnalyzing = uploadedImages.some((img) => img.isAnalyzing)
  const allAnalyzed = uploadedImages.length > 0 && uploadedImages.every(
    (img) => img.analysis !== null
  )
  const hasAnyServicesSelected = uploadedImages.some(
    (img) => img.selectedServices.length > 0
  )

  const priceCalculation = calculateTotalPrices()

  // Handle draft order creation
  const handleGenerateOrder = async (customerInfo: CustomerInfo) => {
    setIsGeneratingOrder(true)
    setOrderError(null)

    try {
      // Save training data for each item (to improve AI)
      for (const image of uploadedImages) {
        if (image.analysis && image.selectedServices.length > 0) {
          try {
            await fetch('/api/training/examples', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image_url: image.url,
                ai_category: image.analysis.category,
                ai_sub_type: image.analysis.sub_type,
                ai_material: image.analysis.material,
                ai_condition: image.analysis.condition,
                ai_issues: image.analysis.issues || [],
                ai_suggested_services: image.analysis.suggested_services,
                correct_services: image.selectedServices.map(s => ({
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
          note: `Created via ISF Cost Estimator for ${uploadedImages.length} item(s)`,
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

      // Set success result
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
    setLocalImages([])
    setUploadedImages([])
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

      {/* Main Content - extra padding at bottom for sticky footer */}
      <div className={`max-w-3xl mx-auto px-4 py-6 space-y-6 ${allAnalyzed && hasAnyServicesSelected && !orderResult ? 'pb-28' : ''}`}>
        {/* Step 1: Upload Images */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Step 1: Upload Photos
          </h2>

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

        {/* Step 2: AI Analysis */}
        {hasUploadedImages && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                Step 2: AI Analysis
              </h2>

              {/* Analyze Button */}
              {hasUnanalyzedImages && (
                <button
                  onClick={handleAnalyzeAll}
                  disabled={isAnyAnalyzing}
                  className={`
                    px-4 py-2 rounded-lg font-medium text-sm
                    transition-colors
                    ${isAnyAnalyzing
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    }
                  `}
                >
                  {isAnyAnalyzing ? 'Analyzing...' : 'Analyze All'}
                </button>
              )}

              {/* All analyzed indicator */}
              {allAnalyzed && (
                <span className="text-sm text-green-600 font-medium">
                  All items analyzed
                </span>
              )}
            </div>

            {/* Item Cards */}
            <div className="space-y-4">
              {uploadedImages.map((image) => (
                <ItemCard
                  key={image.id}
                  imageUrl={image.url}
                  analysis={image.analysis}
                  isAnalyzing={image.isAnalyzing}
                  error={image.analysisError}
                  onRetry={() => handleRetryAnalysis(image.id)}
                />
              ))}
            </div>

            {/* Analysis tips */}
            {hasUnanalyzedImages && !isAnyAnalyzing && (
              <p className="mt-4 text-sm text-gray-500 text-center">
                Click &quot;Analyze All&quot; to get AI-powered service recommendations
              </p>
            )}
          </section>
        )}

        {/* Step 3: Service Selection */}
        {allAnalyzed && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Step 3: Select Services
            </h2>

            {/* Services loading state */}
            {servicesLoading && (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 mt-2">Loading services...</p>
              </div>
            )}

            {/* Services error state */}
            {servicesError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {servicesError}
              </div>
            )}

            {/* Service selectors for each item */}
            {!servicesLoading && !servicesError && (
              <div className="space-y-6">
                {uploadedImages.map((image, index) => {
                  const brand = image.analysis?.brand
                  const showBrand = brand && brand.toLowerCase() !== 'unknown' && brand.toLowerCase() !== 'unknown brand'

                  return (
                  <div key={image.id} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                    {/* Item header with brand */}
                    <div className="flex items-center gap-3 mb-4">
                      <img
                        src={image.url}
                        alt={`Item ${index + 1}`}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Item {index + 1}: {showBrand ? `${brand} ` : ''}
                          {formatCategory(image.analysis?.category, image.analysis?.sub_type)}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatMaterial(image.analysis?.material)}
                          {image.analysis?.color && ` • ${image.analysis.color}`}
                          {image.analysis?.condition && ` • ${image.analysis.condition} condition`}
                        </p>
                      </div>
                    </div>

                    {/* Service selector */}
                    <ServiceSelector
                      services={shopifyServices}
                      suggestedServiceNames={image.analysis?.suggested_services || []}
                      selectedServices={image.selectedServices}
                      onSelectionChange={(selected) =>
                        handleServiceSelectionChange(image.id, selected)
                      }
                      itemCategory={image.analysis?.category}
                      itemSubType={image.analysis?.sub_type}
                    />
                  </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* Step 4: Review & Generate Order */}
        {allAnalyzed && hasAnyServicesSelected && (
          <section id="step-4-order" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 scroll-mt-20">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Step 4: Review & Generate Order
            </h2>

            {/* Show order success if completed */}
            {orderResult ? (
              <OrderSuccess
                invoiceUrl={orderResult.invoiceUrl}
                totalPrice={orderResult.totalPrice}
                customerMessage={orderResult.customerMessage}
                onStartNew={handleStartNew}
              />
            ) : (
              <>
                {/* Price summary */}
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
              </>
            )}
          </section>
        )}

        {/* Hint when no services selected */}
        {allAnalyzed && !hasAnyServicesSelected && !servicesLoading && !servicesError && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              Select services above to see pricing summary
            </p>
          </div>
        )}
      </div>

      {/* Sticky Footer - visible when services are selected */}
      {allAnalyzed && hasAnyServicesSelected && !orderResult && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Total price */}
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-xl font-bold text-gray-900">
                  AED {priceCalculation.grandTotal.toFixed(2)}
                </p>
              </div>

              {/* Generate Order button - scrolls to Step 4 */}
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
