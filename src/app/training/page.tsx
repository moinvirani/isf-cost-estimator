'use client'

/**
 * AI Training Page
 *
 * Staff can review Zoko images and select the correct services.
 * This builds training data to improve AI recommendations.
 */

import { useState, useEffect } from 'react'
import type { ZokoConversationForTraining } from '@/types/training'
import type { ShopifyService } from '@/types/service'

interface SelectedService {
  service: ShopifyService
  quantity: number
}

export default function TrainingPage() {
  // Zoko conversations
  const [conversations, setConversations] = useState<ZokoConversationForTraining[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Shopify services
  const [services, setServices] = useState<ShopifyService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)

  // Selected services for current image
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])

  // Staff info
  const [staffName, setStaffName] = useState('')

  // Saving state
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  // Service search
  const [serviceSearch, setServiceSearch] = useState('')

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

  const currentConversation = conversations[currentIndex]

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
      setCurrentIndex(prev => prev + 1)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const skipImage = () => {
    setSelectedServices([])
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
              Select the correct services for each image
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              Image {currentIndex + 1} of {conversations.length}
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              {/* Customer Image */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-sm text-gray-500 mb-2">
                  From: {currentConversation.customerName}
                </p>
                <img
                  src={currentConversation.imageUrl}
                  alt="Customer item"
                  className="w-full rounded-lg"
                />
                {currentConversation.imageCaption && (
                  <p className="mt-2 text-sm text-gray-700 italic">
                    &quot;{currentConversation.imageCaption}&quot;
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
