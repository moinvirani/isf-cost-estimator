'use client'

/**
 * AI Training Page (Shopify-First)
 *
 * Shows ONLY Zoko conversations that have verified matching Shopify orders.
 * This ensures training data is reliable - we know what services were actually purchased.
 *
 * Flow:
 * 1. Fetch recent Shopify orders (90 days)
 * 2. Match to Zoko customers by phone + name
 * 3. Find images sent before each order
 * 4. Staff verifies and saves training examples
 */

import { useState, useEffect } from 'react'
import type { ShopifyService } from '@/types/service'
import type { TrainingExample } from '@/types/training'

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
  const [stats, setStats] = useState<{ ordersFound: number; matchesFound: number; indexSize: number } | null>(null)

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

  const currentConversation = conversations[currentIndex]
  const currentImages = currentConversation?.images || []
  const currentImage = currentImages[selectedImageIndex] || currentImages[0]

  // Fetch matched conversations and services on mount
  useEffect(() => {
    fetchMatchedConversations()
    fetchServices()
    fetchSavedCount()
  }, [])

  // Auto-apply order services when conversation changes
  useEffect(() => {
    if (currentConversation) {
      applyOrderServices()
      setSelectedImageIndex(0)
    }
  }, [currentIndex, currentConversation])

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
      const res = await fetch('/api/training/matched-conversations?daysBack=90&limit=50')
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setConversations(data.conversations || [])
      setStats(data.stats || null)
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
    for (const lineItem of currentConversation.order.services) {
      // Find matching service in our services list (match by title)
      const matchedService = services.find(
        s => s.title.toLowerCase() === lineItem.title.toLowerCase()
      )
      if (matchedService) {
        newSelected.push({
          service: matchedService,
          quantity: lineItem.quantity,
        })
      }
    }
    setSelectedServices(newSelected)
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
    if (quantity < 1) return
    setSelectedServices(
      selectedServices.map(s =>
        s.service.variant_id === variantId ? { ...s, quantity } : s
      )
    )
  }

  const saveAndNext = async () => {
    if (!currentConversation || selectedServices.length === 0) return
    if (!staffName.trim()) {
      setToast({ message: 'Please enter your name first', type: 'error' })
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
    setSelectedServices([])
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
                  {stats.matchesFound} matches from {stats.ordersFound} orders
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
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Matches Found</h2>
            <p className="text-gray-600 mb-4">
              No Zoko conversations with images were found matching recent Shopify orders.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This could mean:<br />
              • No orders in the last 90 days have matching Zoko customers<br />
              • Customers didn&apos;t send images before their orders<br />
              • Names don&apos;t match between Zoko and Shopify
            </p>
            <button
              onClick={() => fetchMatchedConversations()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Try Again
            </button>
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
                    <span className="text-sm text-green-700">
                      {currentConversation.order.totalPrice} {currentConversation.order.currency}
                    </span>
                  </div>
                  <p className="text-xs text-green-600 mb-2">
                    Ordered: {new Date(currentConversation.order.createdAt).toLocaleDateString()}
                  </p>
                  <div className="text-sm text-green-700">
                    {currentConversation.order.services.map((svc, i) => (
                      <span key={i}>
                        {svc.quantity > 1 ? `${svc.quantity}x ` : ''}{svc.title}
                        {i < currentConversation.order.services.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customer Image Gallery */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-2">
                  Images sent before order ({currentImages.length} photos)
                </p>

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
                  onClick={skipConversation}
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
