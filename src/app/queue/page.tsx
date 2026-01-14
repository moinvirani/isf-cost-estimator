'use client'

/**
 * Lead Queue Page
 *
 * Displays Zoko conversations with product images as leads.
 * Team members can claim, process, and complete leads.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { LeadCard, LeadFilters } from '@/components/queue'
import type { ZokoLead, LeadStatus } from '@/types/queue'

// For now, use a simple user identifier (in production, use auth)
const CURRENT_USER = 'Staff'

type FilterOption = LeadStatus | 'all' | 'mine'

export default function QueuePage() {
  const router = useRouter()
  const [leads, setLeads] = useState<ZokoLead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterOption>('new')

  // Fetch leads from API
  const fetchLeads = useCallback(async () => {
    try {
      setError(null)

      // Build query params based on filter
      const params = new URLSearchParams()

      if (activeFilter === 'mine') {
        params.set('claimedBy', CURRENT_USER)
      } else if (activeFilter !== 'all') {
        params.set('status', activeFilter)
      }

      const response = await fetch(`/api/queue?${params}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch leads')
      }

      setLeads(data.leads)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leads')
    } finally {
      setIsLoading(false)
    }
  }, [activeFilter])

  // Initial fetch
  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Sync with Zoko
  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/queue/sync', { method: 'POST' })
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Sync failed')
      }

      // Refresh leads after sync
      await fetchLeads()

      // Show success message briefly
      if (data.added > 0) {
        alert(`Synced: ${data.added} new leads added`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  // Claim a lead
  const handleClaim = async (leadId: string) => {
    const response = await fetch(`/api/queue/${leadId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimedBy: CURRENT_USER }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to claim lead')
    }

    // Refresh leads
    await fetchLeads()
  }

  // Unclaim a lead
  const handleUnclaim = async (leadId: string) => {
    const response = await fetch(`/api/queue/${leadId}/unclaim`, {
      method: 'POST',
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to release lead')
    }

    await fetchLeads()
  }

  // Skip a lead
  const handleSkip = async (leadId: string) => {
    const response = await fetch(`/api/queue/${leadId}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Skipped by user' }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to skip lead')
    }

    await fetchLeads()
  }

  // View/process a lead
  const handleView = (leadId: string) => {
    router.push(`/queue/${leadId}`)
  }

  // Calculate counts for filters
  const counts = {
    all: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    mine: leads.filter((l) => l.claimed_by === CURRENT_USER).length,
    completed: leads.filter((l) => l.status === 'completed').length,
  }

  // Filter leads based on active filter
  const filteredLeads = leads.filter((lead) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'mine') return lead.claimed_by === CURRENT_USER
    return lead.status === activeFilter
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 pl-16 lg:pl-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Lead Queue</h1>
              <p className="text-sm text-gray-500">
                Zoko conversations with product images
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                transition-colors
                ${isSyncing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <LeadFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={counts}
        />

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading leads...</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredLeads.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-5xl mb-4">
              {activeFilter === 'new' ? '📥' : activeFilter === 'mine' ? '👤' : '📋'}
            </div>
            <h3 className="font-medium text-gray-900 mb-1">No leads found</h3>
            <p className="text-gray-500 text-sm">
              {activeFilter === 'new'
                ? 'No new leads in the queue. Click Sync to fetch from Zoko.'
                : activeFilter === 'mine'
                ? 'You haven\'t claimed any leads yet.'
                : 'No leads match this filter.'}
            </p>
            {activeFilter === 'new' && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Sync from Zoko
              </button>
            )}
          </div>
        )}

        {/* Lead List */}
        {!isLoading && filteredLeads.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                currentUser={CURRENT_USER}
                onClaim={handleClaim}
                onUnclaim={handleUnclaim}
                onView={handleView}
                onSkip={handleSkip}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
