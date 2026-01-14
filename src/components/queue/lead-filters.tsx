'use client'

/**
 * Lead Filters Component
 *
 * Tab filters for the queue page.
 */

import type { LeadStatus } from '@/types/queue'

type FilterOption = LeadStatus | 'all' | 'mine'

interface LeadFiltersProps {
  activeFilter: FilterOption
  onFilterChange: (filter: FilterOption) => void
  counts: {
    all: number
    new: number
    mine: number
    completed: number
  }
}

const filters: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'mine', label: 'My Claims' },
  { value: 'completed', label: 'Completed' },
]

export function LeadFilters({ activeFilter, onFilterChange, counts }: LeadFiltersProps) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg overflow-x-auto">
      {filters.map(({ value, label }) => {
        const count = counts[value as keyof typeof counts] ?? 0
        const isActive = activeFilter === value

        return (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap
              transition-colors
              ${isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            {label}
            <span className={`
              px-1.5 py-0.5 rounded-full text-xs
              ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}
            `}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
