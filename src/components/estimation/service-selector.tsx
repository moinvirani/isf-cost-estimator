'use client'

/**
 * Service Selector Component
 *
 * Displays available services for an item and allows staff to:
 * - See AI-suggested services (highlighted)
 * - Select/deselect services
 * - Adjust quantity for each service
 *
 * Filters services based on AI analysis:
 * - Shoes (mens) → Men's Repair + Sneaker services
 * - Shoes (womens) → Women's Repair + Sneaker services
 * - Bags → Bag Repair services
 */

import type { ShopifyService } from '@/types/service'
import { filterServicesForItem } from '@/lib/shopify'

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
  // Filter services relevant to this item using AI category + sub_type
  const relevantServices = filterServicesForItem(services, itemCategory, itemSubType)

  // Check if a service is selected
  const isSelected = (serviceId: string) =>
    selectedServices.some((s) => s.service.id === serviceId)

  // Check if a service was AI-suggested
  const isAiSuggested = (serviceTitle: string) =>
    suggestedServiceNames.some(
      (name) => serviceTitle.toLowerCase().includes(name.toLowerCase()) ||
               name.toLowerCase().includes(serviceTitle.toLowerCase())
    )

  // Get selected service quantity
  const getQuantity = (serviceId: string) =>
    selectedServices.find((s) => s.service.id === serviceId)?.quantity || 1

  // Toggle service selection
  const toggleService = (service: ShopifyService) => {
    if (isSelected(service.id)) {
      // Remove service
      onSelectionChange(
        selectedServices.filter((s) => s.service.id !== service.id)
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

  // Update quantity for a service
  const updateQuantity = (serviceId: string, quantity: number) => {
    if (quantity < 1) return
    onSelectionChange(
      selectedServices.map((s) =>
        s.service.id === serviceId ? { ...s, quantity } : s
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

  return (
    <div className="space-y-2">
      {relevantServices.map((service) => {
        const selected = isSelected(service.id)
        const suggested = isAiSuggested(service.title)
        const quantity = getQuantity(service.id)

        return (
          <div
            key={service.id}
            className={`
              p-3 rounded-lg border-2 transition-all
              ${selected
                ? 'border-blue-500 bg-blue-50'
                : suggested
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                onClick={() => toggleService(service)}
                className={`
                  mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center
                  transition-colors flex-shrink-0
                  ${selected
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300 hover:border-blue-400'
                  }
                `}
              >
                {selected && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>

              {/* Service info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-medium ${selected ? 'text-blue-900' : 'text-gray-900'}`}
                  >
                    {service.title}
                  </span>

                  {/* AI suggested badge */}
                  {suggested && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 rounded-full">
                      AI Suggested
                    </span>
                  )}
                </div>

                {service.description && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                    {service.description}
                  </p>
                )}

                {/* Price and quantity */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold text-gray-900">
                    AED {service.price.toFixed(2)}
                  </span>

                  {/* Quantity controls (only when selected) */}
                  {selected && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(service.id, quantity - 1)}
                        disabled={quantity <= 1}
                        className={`
                          w-7 h-7 rounded-full flex items-center justify-center
                          ${quantity <= 1
                            ? 'bg-gray-100 text-gray-300'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }
                        `}
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-medium">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(service.id, quantity + 1)}
                        className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>

                {/* Estimated days */}
                {service.estimated_days && (
                  <p className="text-xs text-gray-400 mt-1">
                    Est. {service.estimated_days} day{service.estimated_days !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
