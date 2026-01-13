'use client'

/**
 * Estimation Detail Page
 *
 * Shows full details of a single estimation including
 * all items, services, and customer message.
 */

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

interface ItemService {
  id: string
  service_name: string
  quantity: number
  base_price: number
  final_price: number
  ai_suggested: boolean
}

interface EstimationItem {
  id: string
  image_url: string | null
  category: string | null
  sub_type: string | null
  material: string | null
  color: string | null
  brand: string | null
  condition: string | null
  item_subtotal: number
  item_services: ItemService[]
}

interface Estimation {
  id: string
  created_at: string
  status: string
  customer_name: string | null
  customer_phone: string | null
  grand_total: number
  currency: string
  draft_order_id: string | null
  draft_order_url: string | null
  customer_message: string | null
  estimation_items: EstimationItem[]
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EstimationDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const [estimation, setEstimation] = useState<Estimation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchEstimation = async () => {
      try {
        const response = await fetch(`/api/estimations/${id}`)
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch estimation')
        }

        setEstimation(data.estimation)
      } catch (err) {
        console.error('Failed to fetch estimation:', err)
        setError(err instanceof Error ? err.message : 'Failed to load estimation')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEstimation()
  }, [id])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCategory = (category: string | null, subType: string | null) => {
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
      sneakers: 'Sneakers',
      handbag: 'Handbag',
      clutch: 'Clutch',
      backpack: 'Backpack',
    }

    const cat = categoryLabels[category] || category
    const sub = subType ? (subTypeLabels[subType] || subType) : ''

    return sub ? `${sub} ${cat}` : cat
  }

  const formatMaterial = (material: string | null) => {
    if (!material) return ''
    const labels: Record<string, string> = {
      smooth_leather: 'Smooth Leather',
      suede: 'Suede',
      nubuck: 'Nubuck',
      patent: 'Patent',
      exotic: 'Exotic',
      fabric: 'Fabric',
      synthetic: 'Synthetic',
      mixed: 'Mixed',
    }
    return labels[material] || material
  }

  const handleCopyMessage = async () => {
    if (estimation?.customer_message) {
      await navigator.clipboard.writeText(estimation.customer_message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Error state
  if (error || !estimation) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <Link href="/estimations" className="text-blue-600 font-medium">
              ← Back to History
            </Link>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700">{error || 'Estimation not found'}</p>
            <Link
              href="/estimations"
              className="mt-4 inline-block text-blue-600 font-medium"
            >
              Go to History
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/estimations" className="text-blue-600 font-medium">
              ← Back
            </Link>
            {estimation.draft_order_url && (
              <a
                href={estimation.draft_order_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
              >
                Open in Shopify
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Order Summary */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {estimation.customer_name || 'No name'}
              </h1>
              <p className="text-gray-500">{estimation.customer_phone || 'No phone'}</p>
              <p className="text-sm text-gray-400 mt-1">
                {formatDate(estimation.created_at)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                AED {estimation.grand_total.toFixed(0)}
              </p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium capitalize ${
                estimation.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {estimation.status}
              </span>
            </div>
          </div>
        </section>

        {/* Items */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Items ({estimation.estimation_items.length})
          </h2>

          <div className="space-y-4">
            {estimation.estimation_items.map((item, idx) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={`Item ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg
                          className="w-8 h-8"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {formatCategory(item.category, item.sub_type)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {[
                            formatMaterial(item.material),
                            item.color,
                            item.brand,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                        {item.condition && (
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            item.condition === 'excellent' ? 'bg-green-100 text-green-800' :
                            item.condition === 'good' ? 'bg-blue-100 text-blue-800' :
                            item.condition === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {item.condition}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 whitespace-nowrap">
                        AED {item.item_subtotal.toFixed(0)}
                      </p>
                    </div>

                    {/* Services */}
                    {item.item_services.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">Services:</p>
                        <div className="space-y-1">
                          {item.item_services.map(service => (
                            <div
                              key={service.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-700">
                                {service.service_name}
                                {service.quantity > 1 && (
                                  <span className="text-gray-400 ml-1">
                                    ×{service.quantity}
                                  </span>
                                )}
                                {service.ai_suggested && (
                                  <span className="ml-1 text-xs text-blue-600">
                                    AI
                                  </span>
                                )}
                              </span>
                              <span className="text-gray-600">
                                AED {service.final_price.toFixed(0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Customer Message */}
        {estimation.customer_message && (
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-gray-900">
                Customer Message
              </h2>
              <button
                onClick={handleCopyMessage}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                {estimation.customer_message}
              </pre>
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 py-3 text-center bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            New Estimation
          </Link>
          {estimation.draft_order_url && (
            <a
              href={estimation.draft_order_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 text-center border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              View Checkout
            </a>
          )}
        </div>
      </div>
    </main>
  )
}
