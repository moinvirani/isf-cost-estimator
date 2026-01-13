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

  // Handle upload to Supabase
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

  // Analyze all uploaded images together as ONE item (multiple angles)
  const handleAnalyzeAll = async () => {
    // Get all unanalyzed image URLs
    const imagesToAnalyze = uploadedImages.filter(
      (img) => !img.analysis && !img.isAnalyzing
    )

    if (imagesToAnalyze.length === 0) return

    // Set all as analyzing
    setUploadedImages((prev) =>
      prev.map((img) =>
        imagesToAnalyze.some((i) => i.id === img.id)
          ? { ...img, isAnalyzing: true, analysisError: null }
          : img
      )
    )

    try {
      // Send ALL image URLs to analyze together (same item, different angles)
      const imageUrls = imagesToAnalyze.map((img) => img.url)

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      // Get the combined analysis result
      const analysis: AIAnalysisResult = data.analysis

      // Find matching services for the AI suggestions
      const autoSelectedServices = findMatchingServices(
        analysis.suggested_services,
        analysis.category,
        analysis.sub_type
      )

      // Store the SAME analysis on ALL images (they're the same item)
      // Only the FIRST image will have service selection, others link to it
      setUploadedImages((prev) =>
        prev.map((img, idx) => {
          const isFirst = idx === 0
          if (imagesToAnalyze.some((i) => i.id === img.id)) {
            return {
              ...img,
              analysis,
              isAnalyzing: false,
              selectedServices: isFirst ? autoSelectedServices : [],
            }
          }
          return img
        })
      )
    } catch (error) {
      console.error('Analysis error:', error)
      setUploadedImages((prev) =>
        prev.map((img) =>
          imagesToAnalyze.some((i) => i.id === img.id)
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

  // Retry analysis - re-analyze all images together
  const handleRetryAnalysis = () => {
    // Clear all analysis and retry
    setUploadedImages((prev) =>
      prev.map((img) => ({
        ...img,
        analysis: null,
        analysisError: null,
        selectedServices: [],
      }))
    )
    // Will trigger analyze when user clicks "Analyze" button again
  }

  // Update selected services for the item (applies to all images since they're same item)
  const handleServiceSelectionChange = (
    _imageId: string,
    selectedServices: SelectedService[]
  ) => {
    // Update services on the FIRST image (primary), others are linked
    setUploadedImages((prev) =>
      prev.map((img, idx) =>
        idx === 0 ? { ...img, selectedServices } : img
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

  // Calculate total price for the item (using first image's analysis and services)
  const calculateTotalPrices = () => {
    // Use the first image (primary) which has the shared analysis and services
    const primaryImage = uploadedImages[0]

    if (!primaryImage?.analysis || primaryImage.selectedServices.length === 0) {
      return {
        lineItems: [],
        subtotal: 0,
        modifiersTotal: 0,
        grandTotal: 0,
        currency: 'AED',
      }
    }

    // Calculate with modifiers based on item's material/condition
    return calculatePrices(
      primaryImage.selectedServices,
      primaryImage.analysis.material,
      primaryImage.analysis.condition
    )
  }

  const hasLocalImages = localImages.length > 0
  const hasUploadedImages = uploadedImages.length > 0
  const hasUnanalyzedImages = uploadedImages.some(
    (img) => !img.analysis && !img.isAnalyzing && !img.analysisError
  )
  const isAnyAnalyzing = uploadedImages.some((img) => img.isAnalyzing)
  // All images share the same analysis - check first one
  const allAnalyzed = uploadedImages.length > 0 && uploadedImages[0]?.analysis !== null
  // Services are stored on first image only
  const hasAnyServicesSelected = uploadedImages[0]?.selectedServices.length > 0
  // Get the shared analysis (from first image)
  const sharedAnalysis = uploadedImages[0]?.analysis

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
                  {isAnyAnalyzing ? 'Analyzing...' : `Analyze ${uploadedImages.length} Image${uploadedImages.length !== 1 ? 's' : ''}`}
                </button>
              )}

              {/* All analyzed indicator */}
              {allAnalyzed && (
                <span className="text-sm text-green-600 font-medium">
                  ✓ Item analyzed
                </span>
              )}
            </div>

            {/* Image thumbnails gallery with annotations */}
            {sharedAnalysis ? (
              <div className="mb-4">
                <AnnotatedImageViewer
                  images={uploadedImages.map((img) => ({ id: img.id, url: img.url }))}
                  issues={sharedAnalysis.issues || []}
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Tap an image to view full-screen with issue annotations
                </p>
              </div>
            ) : (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {uploadedImages.map((image, idx) => (
                  <div
                    key={image.id}
                    className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200"
                  >
                    <img
                      src={image.url}
                      alt={`Angle ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {image.isAnalyzing && (
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
            )}

            {/* Analysis result */}
            {sharedAnalysis && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {/* Category & Material */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">
                    {formatCategory(sharedAnalysis.category, sharedAnalysis.sub_type)}
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-600">
                    {formatMaterial(sharedAnalysis.material)}
                  </span>
                  {sharedAnalysis.brand && (
                    <>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-600">{sharedAnalysis.brand}</span>
                    </>
                  )}
                </div>

                {/* Condition */}
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${
                    sharedAnalysis.condition === 'excellent' ? 'bg-green-100 text-green-800' :
                    sharedAnalysis.condition === 'good' ? 'bg-blue-100 text-blue-800' :
                    sharedAnalysis.condition === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {sharedAnalysis.condition} condition
                  </span>
                </div>

                {/* Issues */}
                {sharedAnalysis.issues.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      Detected Issues ({sharedAnalysis.issues.length})
                    </p>
                    <div className="space-y-1">
                      {sharedAnalysis.issues.map((issue, i) => (
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
            )}

            {/* Error state */}
            {uploadedImages[0]?.analysisError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-sm">{uploadedImages[0].analysisError}</p>
                <button
                  onClick={handleRetryAnalysis}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Retry Analysis
                </button>
              </div>
            )}

            {/* Analysis tips */}
            {hasUnanalyzedImages && !isAnyAnalyzing && (
              <p className="mt-4 text-sm text-gray-500 text-center">
                Click &quot;Analyze&quot; to get AI-powered service recommendations for this item
              </p>
            )}
          </section>
        )}

        {/* Step 3: Service Selection */}
        {allAnalyzed && sharedAnalysis && (
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

            {/* Single service selector for the item */}
            {!servicesLoading && !servicesError && (
              <ServiceSelector
                services={shopifyServices}
                suggestedServiceNames={sharedAnalysis.suggested_services || []}
                selectedServices={uploadedImages[0]?.selectedServices || []}
                onSelectionChange={(selected) =>
                  handleServiceSelectionChange(uploadedImages[0]?.id || '', selected)
                }
                itemCategory={sharedAnalysis.category}
                itemSubType={sharedAnalysis.sub_type}
              />
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
