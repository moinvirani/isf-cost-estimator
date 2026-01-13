'use client'

/**
 * Order Success Component
 *
 * Displays after a draft order is successfully created.
 * Shows checkout link and generated customer message with copy buttons.
 */

import { CopyButton } from '@/components/ui/copy-button'

interface OrderSuccessProps {
  invoiceUrl: string
  totalPrice: string
  customerMessage: string
  onStartNew: () => void
}

export function OrderSuccess({
  invoiceUrl,
  totalPrice,
  customerMessage,
  onStartNew,
}: OrderSuccessProps) {
  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Draft Order Created!</h3>
        <p className="text-gray-500 mt-1">
          Total: <span className="font-semibold">AED {totalPrice}</span>
        </p>
      </div>

      {/* Checkout link section */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Checkout Link</h4>
          <CopyButton text={invoiceUrl} label="Copy Link" />
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm break-all"
          >
            {invoiceUrl}
          </a>
        </div>
        <p className="text-xs text-gray-500">
          Send this link to the customer to complete payment
        </p>
      </div>

      {/* Customer message section */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Customer Message</h4>
          <CopyButton text={customerMessage} label="Copy Message" />
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
            {customerMessage}
          </pre>
        </div>
        <p className="text-xs text-gray-500">
          Ready to paste into WhatsApp or Zoko
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 pt-4">
        <a
          href={invoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View in Shopify
        </a>
        <button
          onClick={onStartNew}
          className="w-full h-14 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-semibold transition-colors"
        >
          Start New Estimation
        </button>
      </div>
    </div>
  )
}
