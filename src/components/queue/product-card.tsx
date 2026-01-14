'use client'

/**
 * Product Card Component
 *
 * Displays a single product from AI analysis with its images,
 * analysis results, and service selection.
 * Supports drag-and-drop for image reorganization.
 */

import { useState, useRef } from 'react'
import { RefreshCw, GripVertical, X, Plus } from 'lucide-react'
import { ServiceSelector } from '@/components/estimation'
import { filterServicesForItem } from '@/lib/shopify'
import type { AIAnalysisResult } from '@/types/item'
import type { ShopifyService } from '@/types/service'
import type { QueueImage } from '@/types/queue'

// Selected service with quantity
interface SelectedService {
  service: ShopifyService
  quantity: number
  aiSuggested: boolean
}

interface ProductCardProps {
  productId: string
  productIndex: number
  images: QueueImage[]
  analysis: AIAnalysisResult | null
  selectedServices: SelectedService[]
  allServices: ShopifyService[]
  isAnalyzing: boolean
  onAnalyze: () => void
  onServicesChange: (services: SelectedService[]) => void
  onImageDrop: (imageId: string, fromProductId: string) => void
  onRemoveImage: (imageId: string) => void
  canRemoveImages: boolean  // Only allow removal if multiple products
  totalProducts: number
}

// Format helpers
function formatCategory(category?: string, subType?: string): string {
  if (!category) return 'Item'
  const categoryLabels: Record<string, string> = {
    shoes: 'Shoes',
    bags: 'Bag',
    other_leather: 'Leather Item',
  }
  const subTypeLabels: Record<string, string> = {
    mens: "Men's",
    womens: "Women's",
    sneakers: 'Sneakers',
    handbag: 'Handbag',
  }
  const cat = categoryLabels[category] || category
  const sub = subType ? (subTypeLabels[subType] || subType) : ''
  return sub ? `${sub} ${cat}` : cat
}

function formatMaterial(material?: string): string {
  if (!material) return ''
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

export function ProductCard({
  productId,
  productIndex,
  images,
  analysis,
  selectedServices,
  allServices,
  isAnalyzing,
  onAnalyze,
  onServicesChange,
  onImageDrop,
  onRemoveImage,
  canRemoveImages,
  totalProducts,
}: ProductCardProps) {
  const dropRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Handle drag events for receiving images
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const data = e.dataTransfer.getData('application/json')
    if (data) {
      try {
        const { imageId, fromProductId } = JSON.parse(data)
        if (fromProductId !== productId) {
          onImageDrop(imageId, fromProductId)
        }
      } catch {
        // Invalid data, ignore
      }
    }
  }

  // Handle drag start for images in this card
  const handleImageDragStart = (e: React.DragEvent, imageId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      imageId,
      fromProductId: productId,
    }))
    e.dataTransfer.effectAllowed = 'move'
  }

  // Get relevant services for this item
  const relevantServices = analysis
    ? filterServicesForItem(allServices, analysis.category, analysis.sub_type)
    : allServices

  return (
    <div
      ref={dropRef}
      className={`
        bg-white rounded-xl shadow-sm border-2 transition-colors
        ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          Item {productIndex + 1}
          {analysis && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              {formatCategory(analysis.category, analysis.sub_type)}
              {analysis.brand && ` - ${analysis.brand}`}
            </span>
          )}
        </h3>
        {totalProducts > 1 && (
          <span className="text-xs text-gray-400">
            Drag images to reorganize
          </span>
        )}
      </div>

      {/* Images */}
      <div className="p-4">
        <div className="flex gap-2 flex-wrap">
          {images.map((img) => (
            <div
              key={img.messageId}
              draggable
              onDragStart={(e) => handleImageDragStart(e, img.messageId)}
              className="relative group cursor-grab active:cursor-grabbing"
            >
              <img
                src={img.url}
                alt="Product"
                className="w-20 h-20 object-cover rounded-lg border border-gray-200"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
                <GripVertical className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
              </div>
              {canRemoveImages && images.length > 1 && (
                <button
                  onClick={() => onRemoveImage(img.messageId)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {/* Drop zone indicator */}
          {isDragOver && (
            <div className="w-20 h-20 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center bg-blue-50">
              <Plus className="w-6 h-6 text-blue-400" />
            </div>
          )}
        </div>
      </div>

      {/* Analysis */}
      <div className="px-4 pb-4">
        {!analysis && !isAnalyzing && (
          <button
            onClick={onAnalyze}
            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Analyze This Item
          </button>
        )}

        {isAnalyzing && (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-500 text-sm">Analyzing...</span>
          </div>
        )}

        {analysis && !isAnalyzing && (
          <div className="space-y-4">
            {/* Analysis summary with Re-analyze button */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-medium text-gray-900">
                    {formatMaterial(analysis.material)}
                  </span>
                  <span className="text-gray-400">|</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      analysis.condition === 'excellent'
                        ? 'bg-green-100 text-green-800'
                        : analysis.condition === 'good'
                        ? 'bg-blue-100 text-blue-800'
                        : analysis.condition === 'fair'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {analysis.condition}
                  </span>
                </div>
                <button
                  onClick={onAnalyze}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Re-analyze
                </button>
              </div>

              {analysis.issues && analysis.issues.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {analysis.issues.map((issue, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-gray-200 rounded text-xs text-gray-700"
                    >
                      {issue.type.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Service Selection */}
            <ServiceSelector
              services={relevantServices}
              suggestedServiceNames={analysis.suggested_services || []}
              selectedServices={selectedServices}
              onSelectionChange={onServicesChange}
              itemCategory={analysis.category}
              itemSubType={analysis.sub_type}
            />
          </div>
        )}
      </div>
    </div>
  )
}
