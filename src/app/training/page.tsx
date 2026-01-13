'use client'

/**
 * AI Training Page (Shopify-First)
 *
 * Shows ONLY Zoko conversations that have verified matching Shopify orders.
 * This ensures training data is reliable - we know what services were actually purchased.
 *
 * Flow:
 * 1. Fetch recent Shopify orders (365 days, up to 500 orders)
 * 2. Match to Zoko customers by phone number (primary identifier)
 * 3. Find images sent before each order
 * 4. Staff verifies and saves training examples
 *
 * Performance: Uses parallel batch processing (10 orders at a time) for faster loading.
 */

import { useState, useEffect } from 'react'
import type { ShopifyService } from '@/types/service'
import type { TrainingExample, ItemGroup, GroupImagesResponse } from '@/types/training'

// Types for matched conversation data
interface MatchedImage {
  url: string
  caption?: string
  messageId: string
  timestamp: string
}

interface MatchedConversation {
  order: {
    id: string
    name: string
    createdAt: string
    totalPrice: string
    currency: string
    services: Array<{
      title: string
      quantity: number
      price: string
    }>
  }
  customer: {
    id: string
    name: string
    phone: string
  }
  matchConfidence: 'high' | 'medium' | 'low'
  nameScore: number
  images: MatchedImage[]
  contextMessages: Array<{
    direction: 'FROM_CUSTOMER' | 'FROM_STORE'
    text: string
    timestamp: string
  }>
}

interface SelectedService {
  service: ShopifyService
  quantity: number
}

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
      type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {message}
    </div>
  )
}

// Match confidence badge
function ConfidenceBadge({ confidence, nameScore }: { confidence: 'high' | 'medium' | 'low'; nameScore: number }) {
  const colors = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-orange-100 text-orange-700 border-orange-200',
  }

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colors[confidence]}`}>
      {confidence} ({nameScore}%)
    </span>
  )
}

export default function TrainingPage() {
  // Matched conversations (Shopify order + Zoko images)
  const [conversations, setConversations] = useState<MatchedConversation[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<{ ordersFound: number; matchesFound: number; totalFromApi: number; indexSize: number; alreadyTrained?: number; skipped?: number } | null>(null)

  // Shopify services (full list for manual selection)
  const [services, setServices] = useState<ShopifyService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState<string | null>(null)

  // Selected services for current item
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])

  // Staff info
  const [staffName, setStaffName] = useState('')

  // Saving state
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // View saved examples
  const [showSavedExamples, setShowSavedExamples] = useState(false)
  const [savedExamples, setSavedExamples] = useState<TrainingExample[]>([])
  const [loadingSavedExamples, setLoadingSavedExamples] = useState(false)

  // Service search
  const [serviceSearch, setServiceSearch] = useState('')

  // Gallery: track which image is selected (for multi-image items)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Track unmatched order items (custom products not in catalog)
  const [unmatchedItems, setUnmatchedItems] = useState<Array<{title: string, price: string}>>([])

  // Image grouping state (for multi-item conversations)
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([])
  const [groupingInProgress, setGroupingInProgress] = useState(false)
  const [groupingComplete, setGroupingComplete] = useState(false)

  // Drag-and-drop state
  const [draggedImage, setDraggedImage] = useState<{ messageId: string; fromGroupId: string } | null>(null)
  const [draggedService, setDraggedService] = useState<{ serviceName: string; fromGroupId: string } | null>(null)
  const [dropTargetGroup, setDropTargetGroup] = useState<string | null>(null)

  // Inline editing state
  const [editingBrandGroupId, setEditingBrandGroupId] = useState<string | null>(null)

  // Skipped conversations persistence (localStorage)
  const SKIPPED_STORAGE_KEY = 'isf-training-skipped'

  const getSkippedIds = (): Set<string> => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(SKIPPED_STORAGE_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  }

  const addSkippedId = (messageId: string) => {
    if (typeof window === 'undefined') return
    try {
      const skipped = getSkippedIds()
      skipped.add(messageId)
      localStorage.setItem(SKIPPED_STORAGE_KEY, JSON.stringify([...skipped]))
    } catch (e) {
      console.error('Failed to save skipped ID:', e)
    }
  }

  const clearSkippedIds = () => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(SKIPPED_STORAGE_KEY)
      // Refresh to show previously skipped items
      fetchMatchedConversations()
    } catch (e) {
      console.error('Failed to clear skipped IDs:', e)
    }
  }

  const getSkippedCount = (): number => {
    return getSkippedIds().size
  }

  const currentConversation = conversations[currentIndex]
  const currentImages = currentConversation?.images || []
  const currentImage = currentImages[selectedImageIndex] || currentImages[0]

  // Fetch matched conversations and services on mount
  useEffect(() => {
    fetchMatchedConversations()
    fetchServices()
    fetchSavedCount()
  }, [])

  // Auto-apply order services when conversation changes OR services load
  useEffect(() => {
    if (currentConversation && services.length > 0) {
      applyOrderServices()
      setSelectedImageIndex(0)
      // Reset grouping state when conversation changes
      setItemGroups([])
      setGroupingComplete(false)
    }
  }, [currentIndex, currentConversation, services])

  const fetchSavedCount = async () => {
    try {
      const res = await fetch('/api/training/examples?limit=1000')
      const data = await res.json()
      if (data.success) {
        setSavedCount(data.count || 0)
      }
    } catch (err) {
      console.error('Failed to fetch saved count:', err)
    }
  }

  const fetchSavedExamples = async () => {
    setLoadingSavedExamples(true)
    try {
      const res = await fetch('/api/training/examples?limit=50')
      const data = await res.json()
      if (data.success) {
        setSavedExamples(data.examples || [])
      }
    } catch (err) {
      console.error('Failed to fetch saved examples:', err)
    } finally {
      setLoadingSavedExamples(false)
    }
  }

  const fetchMatchedConversations = async () => {
    setLoading(true)
    setError(null)
    try {
      // First, get list of already-trained message IDs
      const trainedRes = await fetch('/api/training/examples?limit=1000')
      const trainedData = await trainedRes.json()
      const trainedMessageIds = new Set<string>(
        (trainedData.examples || [])
          .map((ex: TrainingExample) => ex.zoko_message_id)
          .filter(Boolean)
      )

      // Get skipped message IDs from localStorage
      const skippedMessageIds = getSkippedIds()

      // Fetch matched conversations
      const res = await fetch('/api/training/matched-conversations?daysBack=365&limit=100')
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      // Filter out conversations where we've already trained OR skipped
      const untrained = (data.conversations || []).filter((conv: MatchedConversation) => {
        // Check if ANY image in this conversation has been trained or skipped
        const hasTrainedImage = conv.images.some(img => trainedMessageIds.has(img.messageId))
        const hasSkippedImage = conv.images.some(img => skippedMessageIds.has(img.messageId))
        return !hasTrainedImage && !hasSkippedImage
      })

      const skippedCount = (data.conversations || []).filter((conv: MatchedConversation) =>
        conv.images.some(img => skippedMessageIds.has(img.messageId))
      ).length

      setConversations(untrained)
      setStats({
        ...data.stats,
        totalFromApi: data.conversations?.length || 0,
        matchesFound: untrained.length,
        alreadyTrained: (data.conversations?.length || 0) - untrained.length - skippedCount,
        skipped: skippedCount,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matched conversations')
    } finally {
      setLoading(false)
    }
  }

  const fetchServices = async () => {
    setServicesLoading(true)
    setServicesError(null)
    try {
      const res = await fetch('/api/services')
      const data = await res.json()
      if (data.success) {
        setServices(data.services || [])
      } else {
        setServicesError(data.error || 'Failed to load services')
      }
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : 'Network error loading services')
    } finally {
      setServicesLoading(false)
    }
  }

  // Apply services from the matched Shopify order (auto pre-fill)
  const applyOrderServices = () => {
    if (!currentConversation || services.length === 0) return

    const newSelected: SelectedService[] = []
    const unmatched: Array<{title: string, price: string}> = []

    for (const lineItem of currentConversation.order.services) {
      const orderTitle = lineItem.title.toLowerCase().trim()
      const orderPrice = parseFloat(lineItem.price)

      // Extract category prefix (before pipe) AND service name (after pipe)
      const orderParts = orderTitle.split('|')
      const categoryPrefix = orderParts.length > 1 ? orderParts[0].trim() : '' // "men's", "women's", "bags"
      const serviceName = orderParts.pop()?.trim() || orderTitle // "heel top-lift replacement"

      // Find matching service by category + title + price
      let matchedService = services.find(s => {
        const serviceTitle = s.title.toLowerCase().trim()
        const servicePrice = typeof s.price === 'string' ? parseFloat(s.price) : s.price

        // Title must match (partial or full)
        const titleMatches =
          serviceTitle === orderTitle ||
          serviceTitle === serviceName ||
          orderTitle.includes(serviceTitle) ||
          serviceTitle.includes(serviceName)

        // Price must match exactly (this ensures we get the right variant)
        const priceMatches = Math.abs(servicePrice - orderPrice) < 0.01

        // Category prefix must match (e.g., "women's" must be in "women's | heel top-lift - rubber")
        // This prevents Men's variant matching when Women's is specified
        const categoryMatches = !categoryPrefix ||
          serviceTitle.includes(categoryPrefix) ||
          serviceTitle.startsWith(categoryPrefix.replace("'s", ""))

        return titleMatches && priceMatches && categoryMatches
      })

      // Fallback: if no exact match, try without category (but still require price)
      if (!matchedService) {
        matchedService = services.find(s => {
          const serviceTitle = s.title.toLowerCase().trim()
          const servicePrice = typeof s.price === 'string' ? parseFloat(s.price) : s.price
          const titleMatches = serviceTitle.includes(serviceName) || serviceName.includes(serviceTitle)
          const priceMatches = Math.abs(servicePrice - orderPrice) < 0.01
          return titleMatches && priceMatches
        })
      }

      if (matchedService) {
        newSelected.push({
          service: matchedService,
          quantity: lineItem.quantity,
        })
      } else {
        // Track unmatched items (custom products not in catalog)
        unmatched.push({ title: lineItem.title, price: lineItem.price })
      }
    }

    setSelectedServices(newSelected)
    setUnmatchedItems(unmatched)
  }

  // Group images by item using AI
  const groupImagesByItem = async () => {
    if (!currentConversation || currentImages.length < 2) return

    setGroupingInProgress(true)
    try {
      const res = await fetch('/api/training/group-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: currentImages.map(img => ({
            url: img.url,
            messageId: img.messageId,
            timestamp: img.timestamp,
            caption: img.caption,
          })),
        }),
      })
      const data: GroupImagesResponse = await res.json()

      if (!data.success || !data.groups) {
        throw new Error(data.error || 'Failed to group images')
      }

      // Convert API response to ItemGroup format with empty selectedServices
      const groups: ItemGroup[] = data.groups.map(g => ({
        groupId: g.groupId,
        images: g.images,
        itemDescription: g.itemDescription,
        identification: {
          brand: g.brand,
          model: g.model,
          category: g.category,
        },
        selectedServices: [],
      }))

      setItemGroups(groups)
      setGroupingComplete(true)

      // Auto-distribute services to groups
      distributeServicesToGroups(groups)

      setToast({
        message: `Found ${groups.length} item(s): ${groups.map(g => g.identification?.brand || g.itemDescription).join(', ')}`,
        type: 'success',
      })
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to group images',
        type: 'error',
      })
    } finally {
      setGroupingInProgress(false)
    }
  }

  // Distribute order services across item groups
  const distributeServicesToGroups = (groups: ItemGroup[]) => {
    if (groups.length === 0 || selectedServices.length === 0) return

    // For each selected service, distribute quantity across groups
    const updatedGroups = groups.map((group, idx) => ({
      ...group,
      selectedServices: selectedServices.map(ss => {
        // Distribute evenly: if 2 services and 2 groups, 1 each
        // For odd quantities, give extra to first groups
        const totalQty = ss.quantity
        const perGroup = Math.floor(totalQty / groups.length)
        const remainder = totalQty % groups.length
        const qty = perGroup + (idx < remainder ? 1 : 0)

        return {
          serviceId: ss.service.variant_id,
          serviceName: ss.service.title,
          quantity: qty,
          unitPrice: typeof ss.service.price === 'string' ? parseFloat(ss.service.price) : ss.service.price,
        }
      }).filter(s => s.quantity > 0), // Only include services with qty > 0
    }))

    setItemGroups(updatedGroups)
  }

  // Update service quantity for a specific group (removes if qty <= 0)
  const updateGroupServiceQuantity = (groupId: string, serviceName: string, newQty: number) => {
    setItemGroups(groups => groups.map(g => {
      if (g.groupId !== groupId) return g
      return {
        ...g,
        selectedServices: g.selectedServices
          .map(s => s.serviceName !== serviceName ? s : { ...s, quantity: newQty })
          .filter(s => s.quantity > 0), // Remove if quantity is 0 or less
      }
    }))
  }

  // Remove a service from a specific group
  const removeServiceFromGroup = (groupId: string, serviceName: string) => {
    setItemGroups(groups => groups.map(g => {
      if (g.groupId !== groupId) return g
      return {
        ...g,
        selectedServices: g.selectedServices.filter(s => s.serviceName !== serviceName),
      }
    }))
  }

  // Update brand name for a specific group
  const updateGroupBrand = (groupId: string, newBrand: string) => {
    setItemGroups(groups => groups.map(g => {
      if (g.groupId !== groupId) return g
      return {
        ...g,
        identification: {
          ...g.identification,
          brand: newBrand.trim() || undefined,
        },
      }
    }))
    setEditingBrandGroupId(null)
  }

  // Add a service to a specific group
  const addServiceToGroup = (groupId: string, service: ShopifyService) => {
    setItemGroups(groups => groups.map(g => {
      if (g.groupId !== groupId) return g
      // Check if already added
      if (g.selectedServices.some(s => s.serviceId === service.variant_id)) return g
      return {
        ...g,
        selectedServices: [...g.selectedServices, {
          serviceId: service.variant_id,
          serviceName: service.title,
          quantity: 1,
          unitPrice: typeof service.price === 'string' ? parseFloat(service.price) : service.price,
        }],
      }
    }))
  }

  // Drag-and-drop: Move image from one group to another
  const moveImageToGroup = (messageId: string, fromGroupId: string, toGroupId: string) => {
    if (fromGroupId === toGroupId) return

    setItemGroups(groups => {
      // Find the image to move
      const fromGroup = groups.find(g => g.groupId === fromGroupId)
      const imageToMove = fromGroup?.images.find(img => img.messageId === messageId)
      if (!imageToMove) return groups

      return groups.map(g => {
        if (g.groupId === fromGroupId) {
          // Remove image from source group
          return { ...g, images: g.images.filter(img => img.messageId !== messageId) }
        }
        if (g.groupId === toGroupId) {
          // Add image to target group
          return { ...g, images: [...g.images, imageToMove] }
        }
        return g
      }).filter(g => g.images.length > 0) // Remove empty groups
    })
  }

  // Drag-and-drop: Move service from one group to another
  const moveServiceToGroup = (serviceName: string, fromGroupId: string, toGroupId: string) => {
    if (fromGroupId === toGroupId) return

    setItemGroups(groups => {
      // Find the service to move
      const fromGroup = groups.find(g => g.groupId === fromGroupId)
      const serviceToMove = fromGroup?.selectedServices.find(s => s.serviceName === serviceName)
      if (!serviceToMove) return groups

      return groups.map(g => {
        if (g.groupId === fromGroupId) {
          // Remove service from source group
          return { ...g, selectedServices: g.selectedServices.filter(s => s.serviceName !== serviceName) }
        }
        if (g.groupId === toGroupId) {
          // Add service to target group (check for duplicates)
          const alreadyExists = g.selectedServices.some(s => s.serviceName === serviceName)
          if (alreadyExists) {
            // Merge quantities
            return {
              ...g,
              selectedServices: g.selectedServices.map(s =>
                s.serviceName === serviceName
                  ? { ...s, quantity: s.quantity + serviceToMove.quantity }
                  : s
              )
            }
          }
          return { ...g, selectedServices: [...g.selectedServices, serviceToMove] }
        }
        return g
      })
    })
  }

  // Image drag handlers
  const handleImageDragStart = (e: React.DragEvent, messageId: string, groupId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', messageId)
    setDraggedImage({ messageId, fromGroupId: groupId })
  }

  const handleImageDragEnd = () => {
    setDraggedImage(null)
    setDropTargetGroup(null)
  }

  // Service drag handlers
  const handleServiceDragStart = (e: React.DragEvent, serviceName: string, groupId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', serviceName)
    setDraggedService({ serviceName, fromGroupId: groupId })
  }

  const handleServiceDragEnd = () => {
    setDraggedService(null)
    setDropTargetGroup(null)
  }

  // Group drop handlers
  const handleGroupDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetGroup(groupId)
  }

  const handleGroupDragLeave = () => {
    setDropTargetGroup(null)
  }

  const handleGroupDrop = (e: React.DragEvent, toGroupId: string) => {
    e.preventDefault()
    setDropTargetGroup(null)

    if (draggedImage) {
      moveImageToGroup(draggedImage.messageId, draggedImage.fromGroupId, toGroupId)
      setDraggedImage(null)
    }
    if (draggedService) {
      moveServiceToGroup(draggedService.serviceName, draggedService.fromGroupId, toGroupId)
      setDraggedService(null)
    }
  }

  const toggleService = (service: ShopifyService) => {
    const exists = selectedServices.find(s => s.service.variant_id === service.variant_id)
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.service.variant_id !== service.variant_id))
    } else {
      setSelectedServices([...selectedServices, { service, quantity: 1 }])
    }
  }

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity < 1) {
      // Remove the service when quantity hits 0
      setSelectedServices(selectedServices.filter(s => s.service.variant_id !== variantId))
      return
    }
    setSelectedServices(
      selectedServices.map(s =>
        s.service.variant_id === variantId ? { ...s, quantity } : s
      )
    )
  }

  const saveAndNext = async () => {
    if (!currentConversation) return
    if (!staffName.trim()) {
      setToast({ message: 'Please enter your name first', type: 'error' })
      return
    }

    // If grouping is complete, save each group separately
    if (groupingComplete && itemGroups.length > 0) {
      const groupsWithServices = itemGroups.filter(g => g.selectedServices.length > 0)
      if (groupsWithServices.length === 0) {
        setToast({ message: 'No services selected for any item', type: 'error' })
        return
      }

      setSaving(true)
      try {
        let savedItems = 0
        for (const group of groupsWithServices) {
          const primaryImage = group.images[0]
          const res = await fetch('/api/training/examples', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_url: primaryImage?.url,
              image_source: 'zoko',
              zoko_customer_id: currentConversation.customer.id,
              zoko_message_id: primaryImage?.messageId,
              zoko_customer_name: currentConversation.customer.name,
              shopify_order_id: currentConversation.order.id,
              shopify_order_name: currentConversation.order.name,
              // Include brand/model in notes
              ai_category: group.identification?.category,
              item_brand: group.identification?.brand,
              item_model: group.identification?.model,
              correct_services: group.selectedServices.map(s => ({
                service_name: s.serviceName,
                shopify_product_id: s.serviceId,
                quantity: s.quantity,
              })),
              verified_by: staffName,
              notes: group.identification?.brand
                ? `${group.identification.brand}${group.identification.model ? ` ${group.identification.model}` : ''}`
                : undefined,
            }),
          })
          const data = await res.json()
          if (data.success) savedItems++
        }

        setSavedCount(prev => prev + savedItems)
        setSelectedServices([])
        setUnmatchedItems([])
        setItemGroups([])
        setGroupingComplete(false)
        setSelectedImageIndex(0)
        setCurrentIndex(prev => prev + 1)

        setToast({
          message: `Saved ${savedItems} item(s) with brand info!`,
          type: 'success'
        })
      } catch (err) {
        setToast({
          message: err instanceof Error ? err.message : 'Failed to save - please try again',
          type: 'error'
        })
      } finally {
        setSaving(false)
      }
      return
    }

    // Original save logic (no grouping)
    if (selectedServices.length === 0) {
      setToast({ message: 'Please select at least one service', type: 'error' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/training/examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: currentImage?.url || currentImages[0]?.url,
          image_source: 'zoko',
          zoko_customer_id: currentConversation.customer.id,
          zoko_message_id: currentImage?.messageId || currentImages[0]?.messageId,
          zoko_customer_name: currentConversation.customer.name,
          shopify_order_id: currentConversation.order.id,
          shopify_order_name: currentConversation.order.name,
          correct_services: selectedServices.map(s => ({
            service_name: s.service.title,
            shopify_product_id: s.service.id,
            quantity: s.quantity,
          })),
          verified_by: staffName,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setSavedCount(prev => prev + 1)
      setSelectedServices([])
      setUnmatchedItems([])
      setSelectedImageIndex(0)
      setCurrentIndex(prev => prev + 1)

      const serviceNames = selectedServices.map(s => s.service.title).join(', ')
      setToast({
        message: `Saved! Services: ${serviceNames.slice(0, 50)}${serviceNames.length > 50 ? '...' : ''}`,
        type: 'success'
      })
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to save - please try again',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const skipConversation = () => {
    // Save all image messageIds as skipped so they don't reappear
    if (currentConversation) {
      for (const img of currentConversation.images) {
        addSkippedId(img.messageId)
      }
    }

    setSelectedServices([])
    setUnmatchedItems([])
    setItemGroups([])
    setGroupingComplete(false)
    setSelectedImageIndex(0)
    setCurrentIndex(prev => prev + 1)
  }

  // Check if we've gone through all conversations
  // BUT only if there's no error and we actually loaded conversations
  if (!loading && !error && conversations.length > 0 && currentIndex >= conversations.length) {
    return (
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Training Complete!</h1>
          <p className="text-gray-600 mb-4">You&apos;ve reviewed all matched conversations.</p>
          <p className="text-lg font-semibold text-green-600 mb-8">
            {savedCount} examples saved
          </p>
          <button
            onClick={() => {
              setCurrentIndex(0)
              fetchMatchedConversations()
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Refresh Matches
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AI Training</h1>
            <p className="text-sm text-gray-500">
              Verified matches: images with confirmed orders
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setShowSavedExamples(true)
                fetchSavedExamples()
              }}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
            >
              View Saved ({savedCount})
            </button>
            <div className="text-right">
              <p className="text-sm text-gray-500">
                Match {currentIndex + 1} of {conversations.length}
              </p>
              {stats && (
                <p className="text-xs text-gray-400">
                  {stats.matchesFound} new
                  {stats.alreadyTrained || stats.skipped ? ' (' : ''}
                  {stats.alreadyTrained ? `${stats.alreadyTrained} trained` : ''}
                  {stats.alreadyTrained && stats.skipped ? ', ' : ''}
                  {stats.skipped ? `${stats.skipped} skipped` : ''}
                  {stats.alreadyTrained || stats.skipped ? ')' : ''} from {stats.ordersFound} orders
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Saved Examples Modal */}
      {showSavedExamples && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Saved Training Examples ({savedExamples.length})
              </h2>
              <button
                onClick={() => setShowSavedExamples(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingSavedExamples ? (
                <div className="text-center py-8">
                  <div className="inline-block h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-500 mt-2">Loading saved examples...</p>
                </div>
              ) : savedExamples.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No training examples saved yet</p>
              ) : (
                <div className="space-y-4">
                  {savedExamples.map((example) => (
                    <div key={example.id} className="flex gap-4 p-3 border border-gray-200 rounded-lg">
                      <img
                        src={example.image_url}
                        alt="Training example"
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {example.zoko_customer_name || 'Unknown customer'}
                        </p>
                        <p className="text-xs text-gray-500 mb-1">
                          Verified by {example.verified_by} on {new Date(example.verified_at || '').toLocaleDateString()}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {example.correct_services.map((svc: { service_name: string }, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"
                            >
                              {svc.service_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Staff Name Input */}
        {!staffName && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name (for tracking)
            </label>
            <input
              type="text"
              placeholder="Enter your name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onBlur={(e) => setStaffName(e.target.value)}
            />
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-4">Building Zoko phone index & matching orders...</p>
            <p className="text-gray-400 text-sm mt-2">This may take a minute on first load</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            {error}
            <button
              onClick={fetchMatchedConversations}
              className="ml-4 px-3 py-1 bg-red-100 rounded text-sm font-medium hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State - No Matches Found */}
        {!loading && !error && conversations.length === 0 && (
          <div className="text-center py-20">
            {/* Check if API found matches but all were filtered out */}
            {stats && stats.totalFromApi > 0 ? (
              <>
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h2>
                <p className="text-gray-600 mb-4">
                  Found {stats.totalFromApi} matched conversation{stats.totalFromApi !== 1 ? 's' : ''}, but all have been processed.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mb-6 inline-block">
                  <div className="flex gap-6 text-sm">
                    {stats.alreadyTrained !== undefined && stats.alreadyTrained > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{stats.alreadyTrained}</p>
                        <p className="text-gray-500">Trained</p>
                      </div>
                    )}
                    {stats.skipped !== undefined && stats.skipped > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-500">{stats.skipped}</p>
                        <p className="text-gray-500">Skipped</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {stats.skipped !== undefined && stats.skipped > 0 && (
                    <button
                      onClick={clearSkippedIds}
                      className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
                    >
                      Clear {stats.skipped} Skipped Item{stats.skipped !== 1 ? 's' : ''}
                    </button>
                  )}
                  <button
                    onClick={() => fetchMatchedConversations()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                  >
                    Refresh Matches
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  Searching {stats.ordersFound} orders from the last 365 days
                </p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">📭</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No Matches Found</h2>
                <p className="text-gray-600 mb-4">
                  No Zoko conversations with images were found matching recent Shopify orders.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  This could mean:<br />
                  • No orders in the last 365 days have matching Zoko customers<br />
                  • Customers didn&apos;t send images before their orders<br />
                  • Phone numbers don&apos;t match between Zoko and Shopify
                </p>
                <button
                  onClick={() => fetchMatchedConversations()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && currentConversation && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Image + Order Info */}
            <div className="space-y-4">
              {/* Customer & Order Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">{currentConversation.customer.name}</p>
                    <p className="text-xs text-gray-500">{currentConversation.customer.phone}</p>
                  </div>
                  <ConfidenceBadge
                    confidence={currentConversation.matchConfidence}
                    nameScore={currentConversation.nameScore}
                  />
                </div>

                {/* Matched Order */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-green-800">{currentConversation.order.name}</span>
                    <span className="text-sm font-semibold text-green-700">
                      Total: {currentConversation.order.totalPrice} {currentConversation.order.currency}
                    </span>
                  </div>
                  <p className="text-xs text-green-600 mb-3">
                    Ordered: {new Date(currentConversation.order.createdAt).toLocaleDateString()}
                  </p>
                  {/* Order line items with prices */}
                  <div className="space-y-1.5">
                    {currentConversation.order.services.map((svc, i) => {
                      // Check if this item was matched or not
                      const isUnmatched = unmatchedItems.some(u => u.title === svc.title)
                      return (
                        <div key={i} className={`flex items-center justify-between text-sm ${isUnmatched ? 'text-orange-700' : ''}`}>
                          <span className={isUnmatched ? 'text-orange-800' : 'text-green-800'}>
                            {svc.quantity > 1 && <span className={isUnmatched ? 'text-orange-600' : 'text-green-600'}>{svc.quantity}x </span>}
                            {svc.title}
                            {isUnmatched && <span className="ml-1 text-xs">(not in catalog)</span>}
                          </span>
                          <span className={`font-medium ${isUnmatched ? 'text-orange-700' : 'text-green-700'}`}>
                            {parseFloat(svc.price) > 0 ? `${svc.price} AED` : 'Free'}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Warning for unmatched items */}
                  {unmatchedItems.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-orange-200">
                      <p className="text-xs text-orange-600">
                        {unmatchedItems.length} item(s) not found in catalog - please select manually from the list
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Image Gallery OR Grouped Items */}
              {groupingComplete && itemGroups.length > 0 ? (
                // Show grouped items
                <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-purple-800 mb-1">
                      {itemGroups.length} item(s) identified - verify services for each
                    </p>
                    <p className="text-xs text-purple-600">
                      Tip: Drag images or services between items to fix wrong assignments
                    </p>
                  </div>

                  {itemGroups.map((group, groupIdx) => (
                    <div
                      key={group.groupId}
                      className={`bg-white rounded-xl shadow-sm border-2 p-4 transition-all ${
                        dropTargetGroup === group.groupId && draggedImage?.fromGroupId !== group.groupId
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : dropTargetGroup === group.groupId && draggedService?.fromGroupId !== group.groupId
                          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                          : 'border-gray-200'
                      }`}
                      onDragOver={(e) => handleGroupDragOver(e, group.groupId)}
                      onDragLeave={handleGroupDragLeave}
                      onDrop={(e) => handleGroupDrop(e, group.groupId)}
                    >
                      {/* Group header with brand info */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            Item {groupIdx + 1}:{' '}
                            {editingBrandGroupId === group.groupId ? (
                              <input
                                type="text"
                                autoFocus
                                defaultValue={group.identification?.brand || ''}
                                placeholder="Enter brand name..."
                                className="inline-block w-40 px-2 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                onBlur={(e) => updateGroupBrand(group.groupId, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateGroupBrand(group.groupId, (e.target as HTMLInputElement).value)
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingBrandGroupId(null)
                                  }
                                }}
                              />
                            ) : (
                              <span
                                onClick={() => setEditingBrandGroupId(group.groupId)}
                                className={`cursor-pointer hover:bg-gray-100 px-1 rounded ${
                                  !group.identification?.brand ? 'text-gray-400 italic' : ''
                                }`}
                                title="Click to edit brand"
                              >
                                {group.identification?.brand || 'Unknown Brand'}
                                <svg className="inline-block w-3 h-3 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </span>
                            )}
                            {group.identification?.model && (
                              <span className="text-gray-600"> {group.identification.model}</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{group.itemDescription}</p>
                          {group.identification?.category && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              {group.identification.category}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{group.images.length} photo(s)</span>
                      </div>

                      {/* Group images (thumbnails) - DRAGGABLE */}
                      <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                        {group.images.map((img, idx) => (
                          <img
                            key={img.messageId}
                            src={img.url}
                            alt={`Item ${groupIdx + 1} - Angle ${idx + 1}`}
                            draggable
                            onDragStart={(e) => handleImageDragStart(e, img.messageId, group.groupId)}
                            onDragEnd={handleImageDragEnd}
                            className={`w-16 h-16 object-cover rounded-lg flex-shrink-0 border-2 cursor-grab active:cursor-grabbing transition-all ${
                              draggedImage?.messageId === img.messageId
                                ? 'border-blue-500 opacity-50 scale-95'
                                : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                            }`}
                            title="Drag to move to another item"
                          />
                        ))}
                        {/* Drop hint when dragging images */}
                        {draggedImage && draggedImage.fromGroupId !== group.groupId && (
                          <div className="w-16 h-16 rounded-lg border-2 border-dashed border-blue-400 bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-500 text-xs text-center">Drop here</span>
                          </div>
                        )}
                      </div>

                      {/* Services for this group - DRAGGABLE */}
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          Services for this item:
                          {group.selectedServices.length > 0 && (
                            <span className="text-gray-400 font-normal ml-1">(drag to reassign)</span>
                          )}
                        </p>
                        {group.selectedServices.length === 0 ? (
                          <div className={`p-2 rounded-lg border-2 border-dashed ${
                            draggedService && draggedService.fromGroupId !== group.groupId
                              ? 'border-purple-400 bg-purple-50'
                              : 'border-gray-200'
                          }`}>
                            <p className="text-xs text-orange-600">
                              {draggedService && draggedService.fromGroupId !== group.groupId
                                ? 'Drop service here'
                                : 'No services - drag from another item or select from list'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {group.selectedServices.map((svc) => (
                              <div
                                key={svc.serviceId}
                                draggable
                                onDragStart={(e) => handleServiceDragStart(e, svc.serviceName, group.groupId)}
                                onDragEnd={handleServiceDragEnd}
                                className={`flex items-center justify-between text-sm p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all ${
                                  draggedService?.serviceName === svc.serviceName && draggedService?.fromGroupId === group.groupId
                                    ? 'bg-purple-100 border-2 border-purple-400 opacity-50'
                                    : 'bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-purple-200'
                                }`}
                                title="Drag to move to another item"
                              >
                                <span className="text-gray-800 flex items-center gap-1 flex-1 min-w-0">
                                  <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
                                  </svg>
                                  <span className="truncate">{svc.serviceName}</span>
                                </span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateGroupServiceQuantity(group.groupId, svc.serviceName, svc.quantity - 1) }}
                                    className="w-5 h-5 rounded bg-gray-200 text-gray-700 text-xs hover:bg-gray-300"
                                  >
                                    -
                                  </button>
                                  <span className="w-4 text-center text-xs">{svc.quantity}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateGroupServiceQuantity(group.groupId, svc.serviceName, svc.quantity + 1) }}
                                    className="w-5 h-5 rounded bg-gray-200 text-gray-700 text-xs hover:bg-gray-300"
                                  >
                                    +
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeServiceFromGroup(group.groupId, svc.serviceName) }}
                                    className="w-5 h-5 rounded bg-red-100 text-red-600 text-xs hover:bg-red-200 ml-1"
                                    title="Remove service"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Drop hint for services */}
                        {draggedService && draggedService.fromGroupId !== group.groupId && group.selectedServices.length > 0 && (
                          <div className="mt-2 p-2 rounded-lg border-2 border-dashed border-purple-400 bg-purple-50">
                            <p className="text-xs text-purple-600 text-center">Drop to add here</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Show original image gallery
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">
                      Images sent before order ({currentImages.length} photos)
                    </p>
                    {/* Group Images button - show when 2+ images */}
                    {currentImages.length >= 2 && !groupingComplete && (
                      <button
                        onClick={groupImagesByItem}
                        disabled={groupingInProgress}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                          groupingInProgress
                            ? 'bg-gray-200 text-gray-500'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        {groupingInProgress ? 'Grouping...' : `Group ${currentImages.length} Images by Item`}
                      </button>
                    )}
                  </div>

                  {/* Main Image */}
                  {currentImage && (
                    <img
                      src={currentImage.url}
                      alt="Customer item"
                      className="w-full rounded-lg"
                    />
                  )}

                {/* Thumbnail Gallery (when multiple images) */}
                {currentImages.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                    {currentImages.map((img, idx) => (
                      <button
                        key={img.messageId}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          idx === selectedImageIndex
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={img.url}
                          alt={`Angle ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Image timestamp */}
                {currentImage && (
                  <p className="text-xs text-gray-400 mt-2">
                    Sent: {new Date(currentImage.timestamp).toLocaleString()}
                  </p>
                )}

                {/* Caption */}
                {currentImage?.caption && (
                  <p className="mt-2 text-sm text-gray-700 italic">
                    &quot;{currentImage.caption}&quot;
                  </p>
                )}
                </div>
              )}

              {/* Conversation Context */}
              {currentConversation.contextMessages.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Conversation Context
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {currentConversation.contextMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`text-sm p-2 rounded ${
                          msg.direction === 'FROM_CUSTOMER'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-blue-50 text-blue-800'
                        }`}
                      >
                        <span className="font-medium">
                          {msg.direction === 'FROM_CUSTOMER' ? 'Customer' : 'ISF'}:
                        </span>{' '}
                        {msg.text.slice(0, 200)}
                        {msg.text.length > 200 && '...'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Service Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Verify Services
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                Pre-filled from order. Adjust if needed.
              </p>

              {/* Search input */}
              <input
                type="text"
                placeholder="Search services... (e.g. suede, heel, bag)"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              {servicesLoading ? (
                <p className="text-gray-500">Loading services...</p>
              ) : servicesError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm mb-2">{servicesError}</p>
                  <button
                    onClick={fetchServices}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200"
                  >
                    Retry
                  </button>
                </div>
              ) : services.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-700 text-sm">No services found.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {services
                    .filter((s) =>
                      serviceSearch === '' ||
                      s.title.toLowerCase().includes(serviceSearch.toLowerCase())
                    )
                    .map((service) => {
                      const selected = selectedServices.find(s => s.service.variant_id === service.variant_id)
                      return (
                        <div
                          key={service.variant_id}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            selected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => toggleService(service)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{service.title}</p>
                              <p className="text-sm text-gray-500">AED {service.price}</p>
                            </div>
                            {selected && (
                              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => updateQuantity(service.variant_id, selected.quantity - 1)}
                                  className="w-6 h-6 rounded bg-gray-200 text-gray-700"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center">{selected.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(service.variant_id, selected.quantity + 1)}
                                  className="w-6 h-6 rounded bg-gray-200 text-gray-700"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}

              {/* Selected Summary - different for grouped vs non-grouped */}
              {groupingComplete && itemGroups.length > 0 ? (
                <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm font-medium text-purple-800">
                    {itemGroups.filter(g => g.selectedServices.length > 0).length} of {itemGroups.length} items have services
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    Click services above to add to specific items
                  </p>
                </div>
              ) : selectedServices.length > 0 ? (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-800">
                    Selected: {selectedServices.map(s => s.service.title).join(', ')}
                  </p>
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={skipConversation}
                  className="flex-1 py-3 px-4 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  Skip
                </button>
                <button
                  onClick={saveAndNext}
                  disabled={saving || (groupingComplete ? itemGroups.every(g => g.selectedServices.length === 0) : selectedServices.length === 0)}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium text-white ${
                    saving || (groupingComplete ? itemGroups.every(g => g.selectedServices.length === 0) : selectedServices.length === 0)
                      ? 'bg-gray-400'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {saving
                    ? 'Saving...'
                    : groupingComplete
                      ? `Save ${itemGroups.filter(g => g.selectedServices.length > 0).length} Item(s)`
                      : 'Save & Next'
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
