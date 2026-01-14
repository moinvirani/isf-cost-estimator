'use client'

/**
 * Process Lead Page
 *
 * Allows team members to analyze a lead's images,
 * select services, and send a quote.
 * Supports multiple products with tabbed view and drag-drop reorganization.
 */

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Phone, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import { PriceSummary, CustomerForm, OrderSuccess } from '@/components/estimation'
import { ProductCard, ImageDock } from '@/components/queue'
import type { CustomerInfo } from '@/components/estimation'
import { calculatePrices } from '@/lib/pricing'
import { filterServicesForItem } from '@/lib/shopify'
import { generateCustomerMessage } from '@/lib/estimation/message-template'
import type { ZokoLead, QueueImage, ProductTrainingData, SavedProductGroup } from '@/types/queue'
import type { AIAnalysisResult } from '@/types/item'
import type { ShopifyService } from '@/types/service'

// For now, use a simple user identifier
const CURRENT_USER = 'Staff'

// Selected service with quantity
interface SelectedService {
  service: ShopifyService
  quantity: number
  aiSuggested: boolean
}

// Product group - each detected item with its images and services
interface ProductGroup {
  id: string
  imageIds: string[]  // Which image messageIds belong to this group
  analysis: AIAnalysisResult | null
  selectedServices: SelectedService[]
  isAnalyzing: boolean
}

// Order result
interface OrderResult {
  draftOrderId: string
  invoiceUrl: string
  totalPrice: string
  customerMessage: string
}

// Tab colors for items
const TAB_COLORS = [
  { active: 'bg-blue-500 text-white', inactive: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  { active: 'bg-green-500 text-white', inactive: 'bg-green-100 text-green-700 hover:bg-green-200' },
  { active: 'bg-purple-500 text-white', inactive: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
  { active: 'bg-orange-500 text-white', inactive: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  { active: 'bg-pink-500 text-white', inactive: 'bg-pink-100 text-pink-700 hover:bg-pink-200' },
]

export default function ProcessLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  // Lead state
  const [lead, setLead] = useState<ZokoLead | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Products state - multiple product groups
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([])
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null)
  const [isDragOverNewItem, setIsDragOverNewItem] = useState(false)
  const [pendingSavedAnalysis, setPendingSavedAnalysis] = useState<SavedProductGroup[] | null>(null)

  // Services state
  const [shopifyServices, setShopifyServices] = useState<ShopifyService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)

  // Order state
  const [isGeneratingOrder, setIsGeneratingOrder] = useState(false)
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)

  // Get image by ID
  const getImageById = useCallback((imageId: string): QueueImage | undefined => {
    return lead?.images.find((img) => img.messageId === imageId)
  }, [lead])

  // Get images for a product group
  const getImagesForGroup = useCallback((group: ProductGroup): QueueImage[] => {
    return group.imageIds
      .map((id) => getImageById(id))
      .filter((img): img is QueueImage => img !== undefined)
  }, [getImageById])

  // Fetch lead data
  useEffect(() => {
    async function fetchLead() {
      try {
        const response = await fetch(`/api/queue/${id}`)
        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch lead')
        }

        setLead(data.lead)

        // Check if there's saved analysis
        const savedAnalysis = data.lead.analysis_result as SavedProductGroup[] | null

        if (savedAnalysis && savedAnalysis.length > 0) {
          // Store for resolution after services load
          setPendingSavedAnalysis(savedAnalysis)
          // Initialize groups without services (will be resolved when services load)
          const initialGroups: ProductGroup[] = savedAnalysis.map((saved) => ({
            id: saved.id,
            imageIds: saved.imageIds,
            analysis: saved.analysis,
            selectedServices: [], // Will be resolved after services load
            isAnalyzing: false,
          }))
          setProductGroups(initialGroups)
        } else {
          // Initialize with all images in one group (not analyzed yet)
          const initialGroup: ProductGroup = {
            id: 'group-0',
            imageIds: data.lead.images.map((img: QueueImage) => img.messageId),
            analysis: null,
            selectedServices: [],
            isAnalyzing: false,
          }
          setProductGroups([initialGroup])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch lead')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLead()
  }, [id])

  // Fetch Shopify services
  useEffect(() => {
    async function fetchServices() {
      try {
        const response = await fetch('/api/services')
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch services')
        }

        setShopifyServices(data.services)
      } catch (err) {
        console.error('Error fetching services:', err)
      } finally {
        setServicesLoading(false)
      }
    }

    fetchServices()
  }, [])

  // Resolve pending saved services when shopifyServices load
  useEffect(() => {
    if (!pendingSavedAnalysis || shopifyServices.length === 0) return

    // Map saved services to actual ShopifyService objects
    setProductGroups((currentGroups) => {
      return currentGroups.map((group) => {
        // Find the saved data for this group
        const savedGroup = pendingSavedAnalysis.find((s) => s.id === group.id)
        if (!savedGroup) return group

        // Resolve services by looking up by serviceId
        const resolvedServices: SelectedService[] = savedGroup.selectedServices
          .map((savedService) => {
            const actualService = shopifyServices.find((s) => s.id === savedService.serviceId)
            if (!actualService) return null
            return {
              service: actualService,
              quantity: savedService.quantity || 1,
              aiSuggested: savedService.aiSuggested || false,
            }
          })
          .filter((s): s is SelectedService => s !== null)

        return {
          ...group,
          selectedServices: resolvedServices,
        }
      })
    })

    // Clear pending state so this doesn't run again
    setPendingSavedAnalysis(null)
  }, [pendingSavedAnalysis, shopifyServices])

  // Save analysis to database
  const saveAnalysis = useCallback(async (groups: ProductGroup[]) => {
    if (!id) return

    // Only save if there's actual analysis
    const hasAnalysis = groups.some((g) => g.analysis !== null)
    if (!hasAnalysis) return

    try {
      const savedGroups: SavedProductGroup[] = groups.map((g) => ({
        id: g.id,
        imageIds: g.imageIds,
        analysis: g.analysis,
        selectedServices: g.selectedServices.map((s) => ({
          serviceId: s.service.id,
          variantId: s.service.variant_id,
          serviceName: s.service.title,
          quantity: s.quantity,
          price: s.service.price,
          aiSuggested: s.aiSuggested,
        })),
      }))

      await fetch(`/api/queue/${id}/save-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productGroups: savedGroups }),
      })
    } catch (err) {
      console.error('Failed to save analysis:', err)
    }
  }, [id])

  // Analyze all images - AI will detect and group them
  const handleAnalyzeAll = async () => {
    if (!lead) return

    setIsAnalyzingAll(true)
    setAnalysisError(null)

    try {
      const imageUrls = lead.images.map((img) => img.url)

      // Extract customer messages as context
      const contextMessages = lead.context_messages
        .filter((m) => m.direction === 'FROM_CUSTOMER')
        .map((m) => m.text)
        .filter((text) => text && text.trim())
        .slice(0, 5)

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls, contextMessages }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      // Create product groups from AI analyses
      const analyses: AIAnalysisResult[] = data.analyses || []
      const newGroups: ProductGroup[] = analyses.map((analysis, idx) => {
        // Map imageIndices to actual image messageIds
        const imageIds = (analysis.imageIndices || [idx]).map((imgIdx) => {
          const img = lead.images[imgIdx]
          return img ? img.messageId : ''
        }).filter(Boolean)

        // Auto-select suggested services
        const relevantServices = filterServicesForItem(
          shopifyServices,
          analysis.category,
          analysis.sub_type
        )
        const autoSelected = findMatchingServices(
          analysis.suggested_services || [],
          relevantServices
        )

        return {
          id: `group-${idx}`,
          imageIds,
          analysis,
          selectedServices: autoSelected,
          isAnalyzing: false,
        }
      })

      // If no analyses returned, keep original group
      if (newGroups.length === 0) {
        setAnalysisError('No items detected in images')
      } else {
        setProductGroups(newGroups)
        setActiveItemIndex(0)
        // Save analysis to database
        await saveAnalysis(newGroups)
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzingAll(false)
    }
  }

  // Find matching services for AI suggestions
  const findMatchingServices = (
    suggestedNames: string[],
    relevantServices: ShopifyService[]
  ): SelectedService[] => {
    return suggestedNames
      .map((suggestedName) => {
        let match = relevantServices.find(
          (s) => s.title.toLowerCase() === suggestedName.toLowerCase()
        )
        if (!match) {
          match = relevantServices.find(
            (s) =>
              s.title.toLowerCase().includes(suggestedName.toLowerCase()) ||
              suggestedName.toLowerCase().includes(s.title.toLowerCase())
          )
        }
        return match
      })
      .filter((s): s is ShopifyService => s !== undefined)
      .map((service) => ({
        service,
        quantity: 1,
        aiSuggested: true,
      }))
  }

  // Handle image drag-drop between groups
  const handleImageDrop = (targetGroupId: string, imageId: string, fromGroupId: string) => {
    setProductGroups((groups) => {
      // Remove image from source group
      const newGroups = groups.map((g) => {
        if (g.id === fromGroupId) {
          return {
            ...g,
            imageIds: g.imageIds.filter((id) => id !== imageId),
          }
        }
        if (g.id === targetGroupId) {
          return {
            ...g,
            imageIds: [...g.imageIds, imageId],
          }
        }
        return g
      })

      // Remove empty groups
      const filteredGroups = newGroups.filter((g) => g.imageIds.length > 0)

      // Adjust active index if needed
      if (activeItemIndex >= filteredGroups.length) {
        setActiveItemIndex(Math.max(0, filteredGroups.length - 1))
      }

      // Save after image reorganization
      saveAnalysis(filteredGroups)

      return filteredGroups
    })
  }

  // Handle removing image from group (creates new single-image group)
  const handleRemoveImage = (groupId: string, imageId: string) => {
    setProductGroups((groups) => {
      const newGroups: ProductGroup[] = []

      for (const g of groups) {
        if (g.id === groupId) {
          // Remove image from this group
          const remainingIds = g.imageIds.filter((id) => id !== imageId)
          if (remainingIds.length > 0) {
            newGroups.push({ ...g, imageIds: remainingIds })
          }
          // Create new group for removed image
          newGroups.push({
            id: `group-${Date.now()}`,
            imageIds: [imageId],
            analysis: null,
            selectedServices: [],
            isAnalyzing: false,
          })
        } else {
          newGroups.push(g)
        }
      }

      return newGroups
    })
  }

  // Handle service selection change for a group
  const handleServicesChange = (groupId: string, services: SelectedService[]) => {
    setProductGroups((groups) => {
      const newGroups = groups.map((g) =>
        g.id === groupId ? { ...g, selectedServices: services } : g
      )
      // Save after service change
      saveAnalysis(newGroups)
      return newGroups
    })
  }

  // Re-analyze a single product group
  const handleReanalyzeItem = async (groupId: string) => {
    if (!lead) return

    // Find the group
    const group = productGroups.find((g) => g.id === groupId)
    if (!group) return

    // Set analyzing state for this group
    setProductGroups((groups) =>
      groups.map((g) =>
        g.id === groupId ? { ...g, isAnalyzing: true } : g
      )
    )

    try {
      // Get image URLs for this group
      const groupImages = getImagesForGroup(group)
      const imageUrls = groupImages.map((img) => img.url)

      // Extract customer messages as context
      const contextMessages = lead.context_messages
        .filter((m) => m.direction === 'FROM_CUSTOMER')
        .map((m) => m.text)
        .filter((text) => text && text.trim())
        .slice(0, 5)

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls, contextMessages }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Analysis failed')
      }

      // Take the first analysis result (assuming single item re-analysis)
      const newAnalysis: AIAnalysisResult | null = data.analyses?.[0] || null

      if (newAnalysis) {
        // Auto-select suggested services
        const relevantServices = filterServicesForItem(
          shopifyServices,
          newAnalysis.category,
          newAnalysis.sub_type
        )
        const autoSelected = findMatchingServices(
          newAnalysis.suggested_services || [],
          relevantServices
        )

        // Update the group with new analysis and save
        setProductGroups((groups) => {
          const newGroups = groups.map((g) =>
            g.id === groupId
              ? { ...g, analysis: newAnalysis, selectedServices: autoSelected, isAnalyzing: false }
              : g
          )
          // Save after re-analysis
          saveAnalysis(newGroups)
          return newGroups
        })
      }
    } catch (err) {
      console.error('Re-analysis failed:', err)
      setProductGroups((groups) =>
        groups.map((g) =>
          g.id === groupId ? { ...g, isAnalyzing: false } : g
        )
      )
    }
  }

  // Navigation handlers
  const goToPrevious = () => setActiveItemIndex((i) => Math.max(0, i - 1))
  const goToNext = () => setActiveItemIndex((i) => Math.min(productGroups.length - 1, i + 1))

  // Calculate total price across all groups
  const allSelectedServices = productGroups.flatMap((g) => g.selectedServices)
  const priceCalculation = allSelectedServices.length > 0
    ? calculatePrices(allSelectedServices)
    : { lineItems: [], subtotal: 0, grandTotal: 0, currency: 'AED' }

  // Generate order
  const handleGenerateOrder = async (customerInfo: CustomerInfo) => {
    if (!lead) return

    setIsGeneratingOrder(true)
    setOrderError(null)

    try {
      // Build line items from all groups
      const lineItems = priceCalculation.lineItems.map((item) => ({
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
          note: `From Zoko lead - ${lead.customer_name || 'Unknown'} (${productGroups.length} item${productGroups.length > 1 ? 's' : ''})`,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create draft order')
      }

      // Generate customer message
      const message = generateCustomerMessage({
        customerName: customerInfo.name,
        items: priceCalculation.lineItems.map((item) => ({
          name: item.serviceName,
          quantity: item.quantity,
          price: item.basePrice,
        })),
        totalPrice: priceCalculation.grandTotal,
        checkoutUrl: data.invoiceUrl,
        currency: 'AED',
      })

      // Build training data from all product groups
      const trainingData: ProductTrainingData[] = productGroups.map((group) => {
        const groupImages = getImagesForGroup(group)
        return {
          imageUrls: groupImages.map((img) => img.url),
          analysis: group.analysis ? {
            category: group.analysis.category,
            subType: group.analysis.sub_type || '',
            material: group.analysis.material || '',
            condition: group.analysis.condition || '',
            issues: (group.analysis.issues || []).map((issue) => ({
              type: issue.type,
              severity: issue.severity,
              location: issue.location,
            })),
          } : null,
          services: group.selectedServices.map((s) => ({
            serviceName: s.service.title,
            serviceId: s.service.id,
          })),
        }
      })

      // Mark lead as completed and save training data
      await fetch(`/api/queue/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftOrderId: data.draftOrderId,
          draftOrderUrl: data.invoiceUrl,
          trainingData,
        }),
      })

      setOrderResult({
        draftOrderId: data.draftOrderId,
        invoiceUrl: data.invoiceUrl,
        totalPrice: data.totalPrice,
        customerMessage: message,
      })
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setIsGeneratingOrder(false)
    }
  }

  // Mark as complete without order
  const handleMarkComplete = async () => {
    try {
      // Build training data - use pending saved analysis if services haven't resolved yet
      let trainingData: ProductTrainingData[] = []

      if (pendingSavedAnalysis && pendingSavedAnalysis.length > 0) {
        // Use pending saved data directly (services haven't resolved from Shopify yet)
        trainingData = pendingSavedAnalysis
          .filter((saved) => saved.analysis && saved.selectedServices.length > 0)
          .map((saved) => {
            // Get image URLs from the saved imageIds
            const imageUrls = saved.imageIds
              .map((imgId) => lead?.images.find((img) => img.messageId === imgId)?.url)
              .filter((url): url is string => !!url)

            return {
              imageUrls,
              analysis: saved.analysis ? {
                category: saved.analysis.category,
                subType: saved.analysis.sub_type || '',
                material: saved.analysis.material || '',
                condition: saved.analysis.condition || '',
                issues: (saved.analysis.issues || []).map((issue) => ({
                  type: issue.type,
                  severity: issue.severity,
                  location: issue.location,
                })),
              } : null,
              services: saved.selectedServices.map((s) => ({
                serviceName: s.serviceName,
                serviceId: s.serviceId,
              })),
            }
          })
      } else {
        // Use resolved productGroups
        trainingData = productGroups
          .filter((group) => group.analysis && group.selectedServices.length > 0)
          .map((group) => {
            const groupImages = getImagesForGroup(group)
            return {
              imageUrls: groupImages.map((img) => img.url),
              analysis: group.analysis ? {
                category: group.analysis.category,
                subType: group.analysis.sub_type || '',
                material: group.analysis.material || '',
                condition: group.analysis.condition || '',
                issues: (group.analysis.issues || []).map((issue) => ({
                  type: issue.type,
                  severity: issue.severity,
                  location: issue.location,
                })),
              } : null,
              services: group.selectedServices.map((s) => ({
                serviceName: s.service.title,
                serviceId: s.service.id,
              })),
            }
          })
      }

      console.log('[MarkComplete] Sending training data:', trainingData.length, 'items')

      await fetch(`/api/queue/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingData }),
      })
      router.push('/queue')
    } catch (err) {
      console.error('Error completing lead:', err)
    }
  }

  // Handle drag start from image dock
  const handleImageDragStart = (imageId: string, fromGroupId: string) => {
    // Could add visual feedback here if needed
  }

  // Handle tab drag events for dropping images on tabs
  const handleTabDragOver = (e: React.DragEvent, tabIndex: number) => {
    e.preventDefault()
    setDragOverTabIndex(tabIndex)
  }

  const handleTabDragLeave = () => {
    setDragOverTabIndex(null)
  }

  const handleTabDrop = (e: React.DragEvent, tabIndex: number) => {
    e.preventDefault()
    setDragOverTabIndex(null)

    const data = e.dataTransfer.getData('application/json')
    if (data) {
      try {
        const { imageId, fromProductId } = JSON.parse(data)
        const targetGroup = productGroups[tabIndex]
        if (targetGroup && fromProductId !== targetGroup.id) {
          handleImageDrop(targetGroup.id, imageId, fromProductId)
        }
      } catch {
        // Invalid data, ignore
      }
    }
  }

  // Handle dropping on "+ New Item" to create a new item
  const handleNewItemDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverNewItem(true)
  }

  const handleNewItemDragLeave = () => {
    setIsDragOverNewItem(false)
  }

  const handleNewItemDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverNewItem(false)

    const data = e.dataTransfer.getData('application/json')
    if (data) {
      try {
        const { imageId, fromProductId } = JSON.parse(data)

        // Create new group with this image
        const newGroupId = `group-${Date.now()}`

        setProductGroups((groups) => {
          // Remove image from source group
          const updatedGroups = groups.map((g) => {
            if (g.id === fromProductId) {
              return {
                ...g,
                imageIds: g.imageIds.filter((id) => id !== imageId),
              }
            }
            return g
          }).filter((g) => g.imageIds.length > 0) // Remove empty groups

          // Add new group with the image
          const newGroup: ProductGroup = {
            id: newGroupId,
            imageIds: [imageId],
            analysis: null,
            selectedServices: [],
            isAnalyzing: false,
          }

          const newGroups = [...updatedGroups, newGroup]

          // Save after creating new item
          saveAnalysis(newGroups)

          return newGroups
        })

        // Switch to the new item tab
        setTimeout(() => {
          setActiveItemIndex(productGroups.length) // Will be the last index after adding
        }, 0)
      } catch {
        // Invalid data, ignore
      }
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading lead...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !lead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Lead not found'}</p>
          <button
            onClick={() => router.push('/queue')}
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Queue
          </button>
        </div>
      </div>
    )
  }

  // Success state
  if (orderResult) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4 pl-16 lg:pl-4">
            <h1 className="text-xl font-semibold text-gray-900">Quote Sent</h1>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <OrderSuccess
            invoiceUrl={orderResult.invoiceUrl}
            totalPrice={orderResult.totalPrice}
            customerMessage={orderResult.customerMessage}
            onStartNew={() => router.push('/queue')}
          />
        </div>
      </div>
    )
  }

  // Check if any analysis has been done
  const hasAnalysis = productGroups.some((g) => g.analysis !== null)
  const activeGroup = productGroups[activeItemIndex]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 pl-16 lg:pl-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/queue')}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Process Lead
              </h1>
              <p className="text-sm text-gray-500">
                {lead.customer_name || 'Unknown Customer'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Customer Info */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-3">Customer Info</h2>
          <div className="flex items-center gap-4 text-sm">
            {lead.customer_phone && (
              <span className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4" />
                {lead.customer_phone}
              </span>
            )}
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">
              {lead.images.length} image{lead.images.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Context Messages */}
          {lead.context_messages.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <MessageSquare className="w-3.5 h-3.5" />
                Customer Messages
              </div>
              <div className="space-y-2">
                {lead.context_messages
                  .filter((m) => m.direction === 'FROM_CUSTOMER')
                  .slice(0, 3)
                  .map((msg, idx) => (
                    <p key={idx} className="text-sm text-gray-700">
                      {msg.text}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* Before Analysis: Show Image Preview */}
        {!hasAnalysis && !isAnalyzingAll && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">
              Images to Analyze
            </h2>

            {/* Image Preview Grid */}
            <div className="flex gap-3 flex-wrap mb-4">
              {lead.images.map((img) => (
                <img
                  key={img.messageId}
                  src={img.url}
                  alt="Product"
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
              ))}
            </div>

            <p className="text-sm text-gray-500 mb-4">
              AI will detect if these are the same or different products
            </p>

            <button
              onClick={handleAnalyzeAll}
              disabled={servicesLoading}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Analyze All Images
            </button>
          </section>
        )}

        {/* Analyzing State */}
        {isAnalyzingAll && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-gray-600">Analyzing images...</p>
              <p className="text-sm text-gray-400">Detecting products and issues</p>
            </div>
          </section>
        )}

        {/* Analysis Error */}
        {analysisError && (
          <section className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700">{analysisError}</p>
            <button
              onClick={handleAnalyzeAll}
              className="mt-2 text-sm font-medium text-red-700 underline"
            >
              Retry Analysis
            </button>
          </section>
        )}

        {/* After Analysis: Tabbed View */}
        {hasAnalysis && (
          <>
            {/* Image Dock - All Images */}
            <ImageDock
              images={lead.images}
              productGroups={productGroups}
              activeItemIndex={activeItemIndex}
              onImageDragStart={handleImageDragStart}
            />

            {/* Items Header with Tabs */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                {productGroups.length} Item{productGroups.length > 1 ? 's' : ''} Detected
              </h2>
              <button
                onClick={handleAnalyzeAll}
                disabled={isAnalyzingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isAnalyzingAll ? 'animate-spin' : ''}`} />
                Re-analyze All
              </button>
            </div>

            {/* Item Tabs - Drop targets for images */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {productGroups.map((group, idx) => {
                const colors = TAB_COLORS[idx % TAB_COLORS.length]
                const isActive = idx === activeItemIndex
                const isDragOver = dragOverTabIndex === idx
                return (
                  <button
                    key={group.id}
                    onClick={() => setActiveItemIndex(idx)}
                    onDragOver={(e) => handleTabDragOver(e, idx)}
                    onDragLeave={handleTabDragLeave}
                    onDrop={(e) => handleTabDrop(e, idx)}
                    className={`
                      px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all
                      ${isActive ? colors.active : colors.inactive}
                      ${isDragOver ? 'ring-2 ring-offset-2 ring-blue-400 scale-105' : ''}
                    `}
                  >
                    Item {idx + 1}
                    <span className="ml-1.5 opacity-75">
                      ({group.imageIds.length} img{group.imageIds.length !== 1 ? 's' : ''})
                    </span>
                    {isDragOver && <span className="ml-1">+</span>}
                  </button>
                )
              })}

              {/* + New Item drop target */}
              <button
                onDragOver={handleNewItemDragOver}
                onDragLeave={handleNewItemDragLeave}
                onDrop={handleNewItemDrop}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all
                  border-2 border-dashed
                  ${isDragOverNewItem
                    ? 'border-green-400 bg-green-50 text-green-700 ring-2 ring-offset-2 ring-green-400 scale-105'
                    : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500'
                  }
                `}
              >
                + New Item
              </button>
            </div>

            {/* Active Item Detail */}
            {activeGroup && (
              <ProductCard
                key={activeGroup.id}
                productId={activeGroup.id}
                productIndex={activeItemIndex}
                images={getImagesForGroup(activeGroup)}
                analysis={activeGroup.analysis}
                selectedServices={activeGroup.selectedServices}
                allServices={shopifyServices}
                isAnalyzing={activeGroup.isAnalyzing}
                onAnalyze={() => handleReanalyzeItem(activeGroup.id)}
                onServicesChange={(services) => handleServicesChange(activeGroup.id, services)}
                onImageDrop={(imageId, fromId) => handleImageDrop(activeGroup.id, imageId, fromId)}
                onRemoveImage={(imageId) => handleRemoveImage(activeGroup.id, imageId)}
                canRemoveImages={productGroups.length > 0}
                totalProducts={productGroups.length}
              />
            )}

            {/* Previous/Next Navigation */}
            {productGroups.length > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={goToPrevious}
                  disabled={activeItemIndex === 0}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    ${activeItemIndex === 0
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-100'
                    }
                  `}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous Item
                </button>

                <span className="text-sm text-gray-500">
                  {activeItemIndex + 1} of {productGroups.length}
                </span>

                <button
                  onClick={goToNext}
                  disabled={activeItemIndex === productGroups.length - 1}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    ${activeItemIndex === productGroups.length - 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-100'
                    }
                  `}
                >
                  Next Item
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Price Summary & Order */}
        {allSelectedServices.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Quote Summary ({productGroups.length} item{productGroups.length > 1 ? 's' : ''})
            </h2>
            <PriceSummary
              lineItems={priceCalculation.lineItems}
              subtotal={priceCalculation.subtotal}
              grandTotal={priceCalculation.grandTotal}
              currency={priceCalculation.currency}
            />

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4">Customer Details</h3>
              <CustomerForm
                onSubmit={handleGenerateOrder}
                isLoading={isGeneratingOrder}
                defaultName={lead.customer_name || undefined}
                defaultPhone={lead.customer_phone || undefined}
              />
            </div>

            {orderError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {orderError}
              </div>
            )}
          </section>
        )}

        {/* Complete Without Order */}
        {hasAnalysis && (
          <div className="flex justify-center">
            <button
              onClick={handleMarkComplete}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg border border-gray-300 transition-colors"
            >
              Mark as Complete (without order)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
