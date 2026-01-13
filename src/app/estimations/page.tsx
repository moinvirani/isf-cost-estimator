'use client'

/**
 * Estimation History Page
 *
 * Lists all past estimations with pagination.
 * Click to view details or access Shopify order.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface EstimationItem {
  id: string
  image_url: string | null
  category: string | null
  material: string | null
  item_subtotal: number
}

interface Estimation {
  id: string
  created_at: string
  status: string
  customer_name: string | null
  customer_phone: string | null
  grand_total: number
  draft_order_id: string | null
  draft_order_url: string | null
  estimation_items: EstimationItem[]
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function EstimationsPage() {
  const [estimations, setEstimations] = useState<Estimation[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEstimations = async (page = 1) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/estimations?page=${page}&limit=20`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch estimations')
      }

      setEstimations(data.estimations)
      setPagination(data.pagination)
    } catch (err) {
      console.error('Failed to fetch estimations:', err)
      setError(err instanceof Error ? err.message : 'Failed to load estimations')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEstimations()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCategory = (category: string | null) => {
    if (!category) return 'Item'
    const labels: Record<string, string> = {
      shoes: 'Shoes',
      bags: 'Bag',
      other_leather: 'Leather',
    }
    return labels[category] || category
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Estimation History
              </h1>
              <p className="text-sm text-gray-500">
                {pagination?.total || 0} total estimations
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              New Estimation
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"
              >
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => fetchEstimations()}
              className="mt-2 text-blue-600 font-medium hover:text-blue-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && estimations.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No estimations yet
            </h3>
            <p className="text-gray-500 mb-4">
              Create your first estimation to see it here.
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create Estimation
            </Link>
          </div>
        )}

        {/* Estimations list */}
        {!isLoading && !error && estimations.length > 0 && (
          <div className="space-y-3">
            {estimations.map(estimation => (
              <Link
                key={estimation.id}
                href={`/estimations/${estimation.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {estimation.estimation_items[0]?.image_url ? (
                      <img
                        src={estimation.estimation_items[0].image_url}
                        alt="Item"
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

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 truncate">
                          {estimation.customer_name || 'No name'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {estimation.customer_phone || 'No phone'}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900 whitespace-nowrap">
                        AED {estimation.grand_total.toFixed(0)}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatDate(estimation.created_at)}</span>
                      <span>•</span>
                      <span>
                        {estimation.estimation_items.length} item
                        {estimation.estimation_items.length !== 1 ? 's' : ''}
                      </span>
                      {estimation.estimation_items[0]?.category && (
                        <>
                          <span>•</span>
                          <span>
                            {formatCategory(estimation.estimation_items[0].category)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0 self-center text-gray-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => fetchEstimations(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className={`px-3 py-2 rounded-lg font-medium text-sm ${
                pagination.page <= 1
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
            >
              Previous
            </button>

            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              onClick={() => fetchEstimations(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className={`px-3 py-2 rounded-lg font-medium text-sm ${
                pagination.page >= pagination.totalPages
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
