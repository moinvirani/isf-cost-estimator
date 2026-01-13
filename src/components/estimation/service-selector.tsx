'use client'

/**
 * Service Selector Component
 *
 * Displays available services for an item and allows staff to:
 * - See AI-suggested services (highlighted at top)
 * - Select/deselect services by clicking anywhere on card
 * - Search/filter services
 * - Adjust quantity for each service
 *
 * Filters services based on AI analysis:
 * - Shoes (mens) → Men's Repair + Sneaker services
 * - Shoes (womens) → Women's Repair + Sneaker services
 * - Bags → Bag Repair services
 */

import { useState, useMemo } from 'react'
import type { ShopifyService } from '@/types/service'
import { filterServicesForItem } from '@/lib/shopify'

// Helper to extract parent product name from service title
// "Sneaker | Spa - Multi-Material Cleaning" → "Sneaker | Spa"
const getParentProductName = (title: string): string => {
  const dashIndex = title.indexOf(' - ')
  return dashIndex > 0 ? title.substring(0, dashIndex) : title
}

// Helper to extract variant name from service title
// "Sneaker | Spa - Multi-Material Cleaning" → "Multi-Material Cleaning"
const getVariantName = (title: string): string => {
  const dashIndex = title.indexOf(' - ')
  return dashIndex > 0 ? title.substring(dashIndex + 3) : ''
}

interface ServiceGroup {
  parentName: string
  variants: ShopifyService[]
  hasAiSuggested: boolean
}

interface SelectedService {
  service: ShopifyService
  quantity: number
  aiSuggested: boolean
}

interface ServiceSelectorProps {
  services: ShopifyService[]
  suggestedServiceNames: string[] // Names suggested by AI
  selectedServices: SelectedService[]
  onSelectionChange: (selected: SelectedService[]) => void
  itemCategory?: string  // AI category: 'shoes' | 'bags' | 'other_leather'
  itemSubType?: string   // AI sub_type: 'mens' | 'womens' | 'kids' | etc.
}

export function ServiceSelector({
  services,
  suggestedServiceNames,
  selectedServices,
  onSelectionChange,
  itemCategory,
  itemSubType,
}: ServiceSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Toggle accordion expand/collapse for non-AI groups
  const toggleGroupExpanded = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  // Filter services relevant to this item using AI category + sub_type
  const relevantServices = filterServicesForItem(services, itemCategory, itemSubType)

  // Check if a service is selected (use variant_id for unique identification)
  const isSelected = (variantId: string) =>
    selectedServices.some((s) => s.service.variant_id === variantId)

  // Check if a service was AI-suggested
  const isAiSuggested = (serviceTitle: string) =>
    suggestedServiceNames.some(
      (name) => serviceTitle.toLowerCase().includes(name.toLowerCase()) ||
               name.toLowerCase().includes(serviceTitle.toLowerCase())
    )

  // Get selected service quantity (use variant_id)
  const getQuantity = (variantId: string) =>
    selectedServices.find((s) => s.service.variant_id === variantId)?.quantity || 1

  // Group services by parent product name
  const groupedServices = useMemo(() => {
    const groups = new Map<string, ServiceGroup>()

    for (const service of relevantServices) {
      const parentName = getParentProductName(service.title)

      if (!groups.has(parentName)) {
        groups.set(parentName, {
          parentName,
          variants: [],
          hasAiSuggested: false,
        })
      }

      const group = groups.get(parentName)!
      group.variants.push(service)
      if (isAiSuggested(service.title)) {
        group.hasAiSuggested = true
      }
    }

    // Sort variants within each group: AI suggested first, then alphabetically
    for (const group of groups.values()) {
      group.variants.sort((a, b) => {
        const aIsSuggested = isAiSuggested(a.title)
        const bIsSuggested = isAiSuggested(b.title)
        if (aIsSuggested && !bIsSuggested) return -1
        if (!aIsSuggested && bIsSuggested) return 1
        return a.title.localeCompare(b.title)
      })
    }

    // Convert to array and sort: AI-suggested groups first, then alphabetically
    return Array.from(groups.values()).sort((a, b) => {
      if (a.hasAiSuggested && !b.hasAiSuggested) return -1
      if (!a.hasAiSuggested && b.hasAiSuggested) return 1
      return a.parentName.localeCompare(b.parentName)
    })
  }, [relevantServices, suggestedServiceNames])

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (searchQuery === '') return groupedServices

    const query = searchQuery.toLowerCase()
    return groupedServices
      .map(group => ({
        ...group,
        variants: group.variants.filter(v =>
          v.title.toLowerCase().includes(query)
        )
      }))
      .filter(group =>
        group.parentName.toLowerCase().includes(query) ||
        group.variants.length > 0
      )
  }, [groupedServices, searchQuery])

  // Toggle service selection (use variant_id for unique identification)
  const toggleService = (service: ShopifyService) => {
    if (isSelected(service.variant_id)) {
      // Remove service
      onSelectionChange(
        selectedServices.filter((s) => s.service.variant_id !== service.variant_id)
      )
    } else {
      // Add service
      onSelectionChange([
        ...selectedServices,
        {
          service,
          quantity: 1,
          aiSuggested: isAiSuggested(service.title),
        },
      ])
    }
  }

  // Update quantity for a service (use variant_id)
  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity < 1) return
    onSelectionChange(
      selectedServices.map((s) =>
        s.service.variant_id === variantId ? { ...s, quantity } : s
      )
    )
  }

  if (relevantServices.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No services available for this item type.
      </div>
    )
  }

  // Separate AI-suggested groups from others
  const aiSuggestedGroups = filteredGroups.filter(g => g.hasAiSuggested)
  const otherGroups = filteredGroups.filter(g => !g.hasAiSuggested)

  // Render a service variant row (reusable for both sections)
  const renderVariant = (service: ShopifyService, index: number) => {
    const selected = isSelected(service.variant_id)
    const suggested = isAiSuggested(service.title)
    const quantity = getQuantity(service.variant_id)
    const variantName = getVariantName(service.title) || 'Default'

    return (
      <div
        key={service.variant_id}
        onClick={() => toggleService(service)}
        className={`
          cursor-pointer min-h-[56px] p-4 transition-all active:bg-opacity-80
          ${index > 0 ? 'border-t border-gray-100' : ''}
          ${selected
            ? 'bg-blue-50'
            : suggested
              ? 'bg-amber-50 hover:bg-amber-100 active:bg-amber-100'
              : 'bg-white hover:bg-gray-50 active:bg-gray-100'}
        `}
      >
        <div className="flex items-center gap-4">
          {/* Checkbox - 44px touch target */}
          <div className="flex items-center justify-center w-11 h-11 -m-2">
            <div className={`
              w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0
              ${selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}
            `}>
              {selected && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>

          {/* Variant info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium text-base ${selected ? 'text-blue-900' : 'text-gray-900'}`}>
                {variantName}
              </span>
              {suggested && (
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 rounded-full">
                  AI Pick
                </span>
              )}
            </div>
            {service.description && (
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                {service.description}
              </p>
            )}
          </div>

          {/* Price + Quantity */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-base font-semibold text-gray-900 whitespace-nowrap">
              AED {service.price.toFixed(2)}
            </span>

            {/* Quantity controls when selected - larger touch targets */}
            {selected && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => updateQuantity(service.variant_id, quantity - 1)}
                  disabled={quantity <= 1}
                  className={`
                    w-9 h-9 rounded-full flex items-center justify-center text-lg font-medium
                    ${quantity <= 1
                      ? 'bg-gray-100 text-gray-300'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'}
                  `}
                >
                  −
                </button>
                <span className="w-8 text-center text-base font-semibold">
                  {quantity}
                </span>
                <button
                  onClick={() => updateQuantity(service.variant_id, quantity + 1)}
                  className="w-9 h-9 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400 flex items-center justify-center text-lg font-medium"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search input - mobile friendly */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-12 px-4 pl-11 border border-gray-300 rounded-xl text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* AI Suggested Groups - Always expanded */}
      {aiSuggestedGroups.map((group) => (
        <div key={group.parentName} className="rounded-xl overflow-hidden border-2 border-amber-300 shadow-sm">
          {/* Group header */}
          <div className="px-4 py-3 bg-amber-100 flex items-center justify-between">
            <span className="font-semibold text-amber-900">{group.parentName}</span>
            <span className="text-xs font-medium text-amber-700 bg-amber-200 px-2 py-1 rounded-full">
              AI Suggested
            </span>
          </div>
          {/* Variants */}
          <div className="bg-white">
            {group.variants.map((service, i) => renderVariant(service, i))}
          </div>
        </div>
      ))}

      {/* Divider if we have both sections */}
      {aiSuggestedGroups.length > 0 && otherGroups.length > 0 && (
        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">Other Services</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}

      {/* Other Groups - Accordion style */}
      {otherGroups.map((group) => {
        const isExpanded = expandedGroups.has(group.parentName)
        const hasSelectedInGroup = group.variants.some(v => isSelected(v.variant_id))

        return (
          <div key={group.parentName} className="rounded-xl overflow-hidden border-2 border-gray-200">
            {/* Accordion header - clickable */}
            <button
              onClick={() => toggleGroupExpanded(group.parentName)}
              className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 active:bg-gray-200 transition-colors min-h-[52px]"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{group.parentName}</span>
                {hasSelectedInGroup && (
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {group.variants.length} option{group.variants.length !== 1 ? 's' : ''}
                </span>
                {/* Chevron */}
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Collapsible content */}
            {isExpanded && (
              <div className="bg-white border-t border-gray-200">
                {group.variants.map((service, i) => renderVariant(service, i))}
              </div>
            )}
          </div>
        )
      })}

      {/* Empty state for search */}
      {filteredGroups.length === 0 && searchQuery && (
        <div className="text-center py-8 text-gray-500">
          <p>No services match &quot;{searchQuery}&quot;</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-blue-600 text-sm font-medium"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  )
}
