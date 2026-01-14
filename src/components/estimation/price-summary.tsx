'use client'

/**
 * Price Summary Component
 *
 * Displays a summary of all selected services and the total price.
 */

import { formatPrice } from '@/lib/pricing'

interface PriceLineItem {
  serviceId: string
  serviceName: string
  quantity: number
  basePrice: number
  lineTotal: number
}

interface PriceSummaryProps {
  lineItems: PriceLineItem[]
  subtotal: number
  grandTotal: number
  currency?: string
  onGenerateOrder?: () => void
  isGenerating?: boolean
}

export function PriceSummary({
  lineItems,
  grandTotal,
  currency = 'AED',
  onGenerateOrder,
  isGenerating = false,
}: PriceSummaryProps) {
  if (lineItems.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <p className="text-gray-500 text-sm">
          Select services above to see pricing
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Line items */}
      <div className="p-4 space-y-3">
        <h3 className="font-medium text-gray-900">Selected Services</h3>

        {lineItems.map((item) => (
          <div
            key={item.serviceId}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex-1">
              <span className="text-gray-700">{item.serviceName}</span>
              {item.quantity > 1 && (
                <span className="text-gray-400 ml-1">×{item.quantity}</span>
              )}
            </div>
            <span className="text-gray-900 font-medium">
              {formatPrice(item.basePrice * item.quantity, currency)}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex justify-between">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-bold text-lg text-gray-900">
            {formatPrice(grandTotal, currency)}
          </span>
        </div>
      </div>

      {/* Generate Order Button */}
      {onGenerateOrder && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onGenerateOrder}
            disabled={isGenerating}
            className={`
              w-full py-3 px-4 rounded-lg font-semibold text-white
              transition-colors
              ${isGenerating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
              }
            `}
          >
            {isGenerating ? 'Generating...' : 'Generate Draft Order'}
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            Creates a draft order in Shopify
          </p>
        </div>
      )}
    </div>
  )
}
