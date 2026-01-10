/**
 * Item Card Component
 *
 * Displays a single item with its image and AI analysis results.
 * Shows: category, material, condition, detected issues, and suggested services.
 */

import type { AIAnalysisResult } from '@/types/item'
import { ConfidenceIndicator } from './confidence-indicator'

interface ItemCardProps {
  imageUrl: string
  analysis: AIAnalysisResult | null
  isAnalyzing?: boolean
  error?: string | null
  onRetry?: () => void
}

// Helper to format category for display
function formatCategory(category: string, subType: string): string {
  const categoryLabels: Record<string, string> = {
    shoes: 'Shoes',
    bags: 'Bag',
    other_leather: 'Leather Item',
  }

  const subTypeLabels: Record<string, string> = {
    mens: "Men's",
    womens: "Women's",
    kids: "Kids'",
    unisex: 'Unisex',
    handbag: 'Handbag',
    clutch: 'Clutch',
    backpack: 'Backpack',
    wallet: 'Wallet',
    briefcase: 'Briefcase',
    tote: 'Tote',
    belt: 'Belt',
    jacket: 'Jacket',
    watch_strap: 'Watch Strap',
    other: 'Other',
  }

  const cat = categoryLabels[category] || category
  const sub = subTypeLabels[subType] || subType

  return `${sub} ${cat}`
}

// Helper to format material for display
function formatMaterial(material: string): string {
  const labels: Record<string, string> = {
    smooth_leather: 'Smooth Leather',
    suede: 'Suede',
    nubuck: 'Nubuck',
    patent: 'Patent Leather',
    exotic: 'Exotic Leather',
    fabric: 'Fabric',
    synthetic: 'Synthetic',
    mixed: 'Mixed Materials',
  }
  return labels[material] || material
}

// Helper to get condition badge color
function getConditionColor(condition: string): string {
  switch (condition) {
    case 'excellent':
      return 'bg-green-100 text-green-800'
    case 'good':
      return 'bg-blue-100 text-blue-800'
    case 'fair':
      return 'bg-yellow-100 text-yellow-800'
    case 'poor':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

// Helper to get severity badge color
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'minor':
      return 'bg-yellow-100 text-yellow-800'
    case 'moderate':
      return 'bg-orange-100 text-orange-800'
    case 'severe':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function ItemCard({ imageUrl, analysis, isAnalyzing, error, onRetry }: ItemCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Image and Basic Info */}
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={imageUrl}
            alt="Item"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info Section */}
        <div className="flex-1 min-w-0">
          {/* Loading State */}
          {isAnalyzing && (
            <div className="space-y-2">
              <div className="h-5 bg-gray-200 rounded animate-pulse w-32" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
            </div>
          )}

          {/* Error State */}
          {error && !isAnalyzing && (
            <div className="space-y-2">
              <p className="text-red-600 text-sm">{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Retry Analysis
                </button>
              )}
            </div>
          )}

          {/* Analysis Results */}
          {analysis && !isAnalyzing && (
            <div className="space-y-1">
              {/* Category & Type */}
              <h3 className="font-semibold text-gray-900 truncate">
                {formatCategory(analysis.category, analysis.sub_type)}
              </h3>

              {/* Material & Color */}
              <p className="text-sm text-gray-600">
                {formatMaterial(analysis.material)}
                {analysis.color && ` • ${analysis.color}`}
              </p>

              {/* Brand (if identified) */}
              {analysis.brand && (
                <p className="text-sm text-gray-500">Brand: {analysis.brand}</p>
              )}

              {/* Condition Badge */}
              <div className="pt-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${getConditionColor(analysis.condition)}`}
                >
                  {analysis.condition} condition
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Details (shown when we have results) */}
      {analysis && !isAnalyzing && (
        <div className="border-t border-gray-100">
          {/* Confidence Indicator */}
          <div className="px-4 py-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">AI Confidence</p>
            <ConfidenceIndicator confidence={analysis.confidence} />
          </div>

          {/* Detected Issues */}
          {analysis.issues.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">
                Detected Issues ({analysis.issues.length})
              </p>
              <div className="space-y-2">
                {analysis.issues.map((issue, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium text-gray-800">
                        {issue.type.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${getSeverityColor(issue.severity)}`}
                      >
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {issue.location.replace(/_/g, ' ')} - {issue.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Services */}
          {analysis.suggested_services.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Suggested Services</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.suggested_services.map((service, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                  >
                    {service}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes (if any) */}
          {analysis.notes && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-600">{analysis.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
