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
import { ImageUpload, ItemCard, ServiceSelector, PriceSummary } from '@/components/estimation'
import { uploadImages } from '@/lib/supabase/storage'
import { calculatePrices } from '@/lib/pricing'
import type { AIAnalysisResult } from '@/types/item'
import type { ShopifyService } from '@/types/service'

// Type for our uploaded images (before Supabase upload)
interface LocalImage {
  id: string
  file: File
  previewUrl: string
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

  // Analyze a single image
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

      // Update with analysis results
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? { ...img, analysis: data.analysis, isAnalyzing: false }
            : img
        )
      )
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
      // Upload all images to Supabase Storage
      const files = localImages.map((img) => img.file)
      const results = await uploadImages(files)

      // Map results to our format with initial analysis state
      const uploaded: UploadedImage[] = results.map((result, index) => ({
        id: localImages[index].id,
        url: result.url,
        path: result.path,
        analysis: null,
        isAnalyzing: false,
        analysisError: null,
        selectedServices: [],
      }))

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
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
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
                {uploadedImages.map((image, index) => (
                  <div key={image.id} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                    {/* Item header */}
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={image.url}
                        alt={`Item ${index + 1}`}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Item {index + 1}: {image.analysis?.sub_type || image.analysis?.category}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {image.analysis?.material?.replace('_', ' ')} - {image.analysis?.condition} condition
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
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 4: Price Summary */}
        {allAnalyzed && hasAnyServicesSelected && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Step 4: Review & Generate Order
            </h2>

            <PriceSummary
              lineItems={priceCalculation.lineItems}
              subtotal={priceCalculation.subtotal}
              modifiersTotal={priceCalculation.modifiersTotal}
              grandTotal={priceCalculation.grandTotal}
              currency={priceCalculation.currency}
              onGenerateOrder={() => {
                // Placeholder for M5 - Shopify draft order creation
                alert('Draft order generation coming in the next phase!')
              }}
            />
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
    </main>
  )
}
