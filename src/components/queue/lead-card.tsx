'use client'

/**
 * Lead Card Component
 *
 * Displays a lead in the queue with customer info, images, and actions.
 */

import { useState } from 'react'
import { Clock, User, Eye, Check, X } from 'lucide-react'
import type { ZokoLead } from '@/types/queue'

interface LeadCardProps {
  lead: ZokoLead
  currentUser: string
  onClaim: (leadId: string) => Promise<void>
  onUnclaim: (leadId: string) => Promise<void>
  onView: (leadId: string) => void
  onSkip: (leadId: string) => Promise<void>
}

// Format time ago
function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

// Status badge colors
const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  claimed: 'bg-yellow-100 text-yellow-800',
  analyzed: 'bg-purple-100 text-purple-800',
  quoted: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  skipped: 'bg-red-100 text-red-800',
}

export function LeadCard({
  lead,
  currentUser,
  onClaim,
  onUnclaim,
  onView,
  onSkip,
}: LeadCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const isClaimedByMe = lead.claimed_by === currentUser
  const isClaimedByOther = lead.claimed_by && lead.claimed_by !== currentUser
  const canClaim = lead.status === 'new'
  const canProcess = isClaimedByMe || lead.status === 'new'

  const handleClaim = async () => {
    setIsLoading(true)
    try {
      await onClaim(lead.id)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnclaim = async () => {
    setIsLoading(true)
    try {
      await onUnclaim(lead.id)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = async () => {
    setIsLoading(true)
    try {
      await onSkip(lead.id)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`
      bg-white rounded-xl border-2 p-4 transition-all
      ${isClaimedByMe ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'}
      ${lead.status === 'completed' || lead.status === 'skipped' ? 'opacity-60' : ''}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            {lead.customer_name || 'Unknown Customer'}
          </h3>
          <p className="text-sm text-gray-500 truncate">
            {lead.customer_phone || 'No phone'}
          </p>
        </div>
        <span className={`
          px-2 py-1 rounded-full text-xs font-medium capitalize
          ${statusColors[lead.status] || 'bg-gray-100 text-gray-800'}
        `}>
          {lead.status}
        </span>
      </div>

      {/* Image Thumbnails */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {lead.images.slice(0, 4).map((image, idx) => (
          <div
            key={image.messageId}
            className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
          >
            <img
              src={image.url}
              alt={`Image ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            {idx === 3 && lead.images.length > 4 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  +{lead.images.length - 4}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Meta Info */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {timeAgo(lead.first_image_at)}
        </span>
        {lead.claimed_by && (
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {isClaimedByMe ? 'You' : lead.claimed_by}
          </span>
        )}
        <span>{lead.images.length} image{lead.images.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Context Preview */}
      {lead.context_messages.length > 0 && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 line-clamp-2">
            {lead.context_messages.find(m => m.direction === 'FROM_CUSTOMER')?.text ||
             lead.context_messages[0]?.text || 'No message'}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {canClaim && !isClaimedByOther && (
          <button
            onClick={handleClaim}
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Claim
          </button>
        )}

        {isClaimedByMe && (
          <>
            <button
              onClick={() => onView(lead.id)}
              className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center justify-center gap-1 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Process
            </button>
            <button
              onClick={handleUnclaim}
              disabled={isLoading}
              className="px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
            >
              Release
            </button>
          </>
        )}

        {isClaimedByOther && (
          <div className="flex-1 px-3 py-2 bg-gray-100 text-gray-500 text-sm text-center rounded-lg">
            Claimed by {lead.claimed_by}
          </div>
        )}

        {(lead.status === 'new' || isClaimedByMe) && lead.status !== 'skipped' && (
          <button
            onClick={handleSkip}
            disabled={isLoading}
            className="px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Skip this lead"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {lead.status === 'completed' && (
          <button
            onClick={() => onView(lead.id)}
            className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 flex items-center justify-center gap-1 transition-colors"
          >
            <Eye className="w-4 h-4" />
            View
          </button>
        )}
      </div>
    </div>
  )
}
