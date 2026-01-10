'use client'

/**
 * AI Training Page
 *
 * Staff can review Zoko images and select the correct services.
 * Shows grouped images (different angles of same item).
 * Prioritizes customers with Shopify orders.
 * Semi-automatic: Shows Shopify orders to pre-fill services.
 */

import { useState, useEffect, useCallback } from 'react'
import type { ZokoConversationForTraining, ZokoImage } from '@/types/training'
import type { ShopifyService } from '@/types/service'

interface SelectedService {
  service: ShopifyService
  quantity: number
}

// Get images from conversation (handles both new and legacy format)
function getImages(conversation: ZokoConversationForTraining): ZokoImage[] {
  if (conversation.images && conversation.images.length > 0) {
    return conversation.images
  }
  // Legacy format fallback
  if (conversation.imageUrl) {
    return [{
      url: conversation.imageUrl,
      caption: conversation.imageCaption,
      messageId: conversation.messageId || '',
      timestamp: conversation.timestamp,
    }]
  }
  return []
}

// Shopify order from our API
interface OrderService {
  title: string
  quantity: number
  price: string
}

interface ShopifyOrderForTraining {
  id: string
  orderNumber: string
  createdAt: string
  totalAmount: string
  currency: string
  services: OrderService[]
}

export default function TrainingPage() {
  // Zoko conversations
  const [conversations, setConversations] = useState<ZokoConversationForTraining[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Shopify services (full list)
  const [services, setServices] = useState<ShopifyService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)

  // Shopify orders for current customer
  const [customerOrders, setCustomerOrders] = useState<ShopifyOrderForTraining[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  // Selected services for current image
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])

  // Staff info
  const [staffName, setStaffName] = useState('')

  // Saving state
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  // Service search
  const [serviceSearch, setServiceSearch] = useState('')

  // Gallery: track which image is selected (for multi-image items)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const currentConversation = conversations[currentIndex]
  const currentImages = currentConversation ? getImages(currentConversation) : []
  const currentImage = currentImages[selectedImageIndex] || currentImages[0]

  // Fetch Shopify orders for current customer
  const fetchCustomerOrders = useCallback(async (phone: string) => {
    if (!phone) {
      setCustomerOrders([])
      return
    }
    setOrdersLoading(true)
    try {
      const res = await fetch(`/api/training/orders?phone=${encodeURIComponent(phone)}&limit=5`)
      const data = await res.json()
      if (data.success) {
        setCustomerOrders(data.orders || [])
      } else {
        setCustomerOrders([])
      }
    } catch (err) {
      console.error('Failed to load orders:', err)
      setCustomerOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  // Fetch orders when conversation changes
  useEffect(() => {
    if (currentConversation?.customerPhone) {
      fetchCustomerOrders(currentConversation.customerPhone)
    } else {
      setCustomerOrders([])
    }
  }, [currentConversation?.customerPhone, fetchCustomerOrders])

  // Fetch Zoko images and Shopify services on mount
  useEffect(() => {
    fetchZokoImages()
    fetchServices()
  }, [])

  const fetchZokoImages = async (page = 200) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/training/zoko-images?page=${page}&limit=20`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setConversations(data.conversations || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images')
    } finally {
      setLoading(false)
    }
  }

  const fetchServices = async () => {
    setServicesLoading(true)
    try {
      const res = await fetch('/api/services')
      const data = await res.json()
      if (data.success) setServices(data.services || [])
    } catch (err) {
      console.error('Failed to load services:', err)
    } finally {
      setServicesLoading(false)
    }
  }

  const toggleService = (service: ShopifyService) => {
    const exists = selectedServices.find(s => s.service.id === service.id)
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.service.id !== service.id))
    } else {
      setSelectedServices([...selectedServices, { service, quantity: 1 }])
    }
  }

  const updateQuantity = (serviceId: string, quantity: number) => {
    if (quantity < 1) return
    setSelectedServices(
      selectedServices.map(s =>
        s.service.id === serviceId ? { ...s, quantity } : s
      )
    )
  }

  // Use services from a Shopify order (semi-automatic training)
  const useOrderServices = (order: ShopifyOrderForTraining) => {
    const newSelected: SelectedService[] = []
    for (const orderService of order.services) {
      // Find matching service in our services list
      const matchedService = services.find(
        s => s.title.toLowerCase() === orderService.title.toLowerCase()
      )
      if (matchedService) {
        newSelected.push({
          service: matchedService,
          quantity: orderService.quantity,
        })
      }
    }
    setSelectedServices(newSelected)
  }

  const saveAndNext = async () => {
    if (!currentConversation || selectedServices.length === 0) return
    if (!staffName.trim()) {
      alert('Please enter your name')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/training/examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: currentConversation.imageUrl,
          image_source: 'zoko',
          zoko_customer_id: currentConversation.customerId,
          zoko_message_id: currentConversation.messageId,
          zoko_customer_name: currentConversation.customerName,
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
      setCustomerOrders([])
      setSelectedImageIndex(0) // Reset gallery
      setCurrentIndex(prev => prev + 1)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const skipImage = () => {
    setSelectedServices([])
    setCustomerOrders([])
    setSelectedImageIndex(0) // Reset gallery
    setCurrentIndex(prev => prev + 1)
  }

  // Check if we've gone through all images
  if (!loading && currentIndex >= conversations.length) {
    return (
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto text-center py-20">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Training Complete!</h1>
          <p className="text-gray-600 mb-4">You&apos;ve reviewed all images in this batch.</p>
          <p className="text-lg font-semibold text-green-600 mb-8">
            {savedCount} examples saved
          </p>
          <button
            onClick={() => {
              setCurrentIndex(0)
              fetchZokoImages(250) // Load next batch
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Load More Images
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AI Training</h1>
            <p className="text-sm text-gray-500">
              Select the correct services for each item
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              Item {currentIndex + 1} of {conversations.length}
              {currentImages.length > 1 && (
                <span className="ml-1 text-blue-600">
                  ({currentImages.length} photos)
                </span>
              )}
            </p>
            <p className="text-sm font-medium text-green-600">
              {savedCount} saved
            </p>
          </div>
        </div>
      </header>

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
            <p className="text-gray-500 mt-4">Loading images from Zoko...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && currentConversation && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Image + Context */}
            <div className="space-y-4">
              {/* Customer Image Gallery */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">
                    From: {currentConversation.customerName}
                  </p>
                  {currentConversation.hasOrders && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      Has Orders
                    </span>
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

                {/* Image count indicator */}
                {currentImages.length > 1 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Photo {selectedImageIndex + 1} of {currentImages.length} - Click thumbnails to view different angles
                  </p>
                )}

                {/* Caption */}
                {currentImage?.caption && (
                  <p className="mt-2 text-sm text-gray-700 italic">
                    &quot;{currentImage.caption}&quot;
                  </p>
                )}
              </div>

              {/* Conversation Context */}
              {currentConversation.contextMessages.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Conversation Context
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
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

              {/* Customer Shopify Orders - Semi-automatic training */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Shopify Orders
                  {currentConversation.customerPhone && (
                    <span className="ml-2 text-xs text-gray-400">
                      ({currentConversation.customerPhone})
                    </span>
                  )}
                </h3>
                {ordersLoading ? (
                  <p className="text-sm text-gray-500">Loading orders...</p>
                ) : customerOrders.length === 0 ? (
                  <p className="text-sm text-gray-500">No orders found for this customer</p>
                ) : (
                  <div className="space-y-3">
                    {customerOrders.map((order) => (
                      <div
                        key={order.id}
                        className="border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-900">{order.orderNumber}</span>
                            <span className="ml-2 text-xs text-gray-500">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {order.currency} {parseFloat(order.totalAmount).toFixed(0)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {order.services.map((s, i) => (
                            <span key={i}>
                              {s.quantity > 1 ? `${s.quantity}x ` : ''}{s.title}
                              {i < order.services.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => useOrderServices(order)}
                          className="w-full py-2 px-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 border border-green-200"
                        >
                          Use These Services
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Service Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select Correct Services
              </h3>

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
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {services
                    .filter((s) =>
                      serviceSearch === '' ||
                      s.title.toLowerCase().includes(serviceSearch.toLowerCase())
                    )
                    .map((service) => {
                    const selected = selectedServices.find(s => s.service.id === service.id)
                    return (
                      <div
                        key={service.id}
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
                                onClick={() => updateQuantity(service.id, selected.quantity - 1)}
                                className="w-6 h-6 rounded bg-gray-200 text-gray-700"
                              >
                                −
                              </button>
                              <span className="w-6 text-center">{selected.quantity}</span>
                              <button
                                onClick={() => updateQuantity(service.id, selected.quantity + 1)}
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

              {/* Selected Summary */}
              {selectedServices.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-800">
                    Selected: {selectedServices.map(s => s.service.title).join(', ')}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={skipImage}
                  className="flex-1 py-3 px-4 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  Skip
                </button>
                <button
                  onClick={saveAndNext}
                  disabled={saving || selectedServices.length === 0}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium text-white ${
                    saving || selectedServices.length === 0
                      ? 'bg-gray-400'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {saving ? 'Saving...' : 'Save & Next'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
