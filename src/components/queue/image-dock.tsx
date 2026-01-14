'use client'

/**
 * Image Dock Component
 *
 * Displays all images in a horizontal scrollable row with badges
 * showing which item each image belongs to. Images are draggable
 * for reorganization between items. Click to preview full size.
 */

import { useState } from 'react'
import { GripVertical } from 'lucide-react'
import { ImagePreviewModal } from './image-preview-modal'
import type { QueueImage } from '@/types/queue'

// Colors for item badges
const ITEM_COLORS = [
  { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500' },
  { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' },
  { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-500' },
  { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500' },
  { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-500' },
]

interface ProductGroup {
  id: string
  imageIds: string[]
}

interface ImageDockProps {
  images: QueueImage[]
  productGroups: ProductGroup[]
  activeItemIndex: number
  onImageDragStart: (imageId: string, fromGroupId: string) => void
}

export function ImageDock({
  images,
  productGroups,
  activeItemIndex,
  onImageDragStart,
}: ImageDockProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  // Find which group an image belongs to
  const getImageGroup = (imageId: string): { index: number; groupId: string } | null => {
    for (let i = 0; i < productGroups.length; i++) {
      if (productGroups[i].imageIds.includes(imageId)) {
        return { index: i, groupId: productGroups[i].id }
      }
    }
    return null
  }

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, imageId: string) => {
    const groupInfo = getImageGroup(imageId)
    if (groupInfo) {
      e.dataTransfer.setData('application/json', JSON.stringify({
        imageId,
        fromProductId: groupInfo.groupId,
      }))
      e.dataTransfer.effectAllowed = 'move'
      onImageDragStart(imageId, groupInfo.groupId)
    }
  }

  // Handle image click (open preview)
  const handleImageClick = (index: number) => {
    setPreviewIndex(index)
  }

  // Preview navigation
  const handlePreviousImage = () => {
    if (previewIndex !== null && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1)
    }
  }

  const handleNextImage = () => {
    if (previewIndex !== null && previewIndex < images.length - 1) {
      setPreviewIndex(previewIndex + 1)
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">All Images</h3>
          <span className="text-xs text-gray-400">Click to preview • Drag to tabs below</span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((img, index) => {
            const groupInfo = getImageGroup(img.messageId)
            const itemIndex = groupInfo?.index ?? 0
            const colors = ITEM_COLORS[itemIndex % ITEM_COLORS.length]
            const isActiveItem = itemIndex === activeItemIndex

            return (
              <div
                key={img.messageId}
                draggable
                onDragStart={(e) => handleDragStart(e, img.messageId)}
                onClick={() => handleImageClick(index)}
                className={`
                  relative flex-shrink-0 cursor-pointer group
                  ${isActiveItem ? 'ring-2 ring-offset-2 ring-blue-400' : ''}
                `}
              >
                <img
                  src={img.url}
                  alt="Product"
                  className={`w-16 h-16 object-cover rounded-lg border-2 ${colors.border} transition-transform group-hover:scale-105`}
                />

                {/* Item badge */}
                <div className={`
                  absolute -top-2 -right-2 w-5 h-5 rounded-full
                  ${colors.bg} ${colors.text}
                  text-xs font-medium flex items-center justify-center
                  shadow-sm
                `}>
                  {itemIndex + 1}
                </div>

                {/* Drag indicator on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                  <GripVertical className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        {productGroups.length > 1 && (
          <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
            {productGroups.map((group, idx) => {
              const colors = ITEM_COLORS[idx % ITEM_COLORS.length]
              return (
                <div key={group.id} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
                  <span>Item {idx + 1}</span>
                  <span className="text-gray-400">({group.imageIds.length})</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewIndex !== null && (
        <ImagePreviewModal
          imageUrl={images[previewIndex].url}
          onClose={() => setPreviewIndex(null)}
          onPrevious={handlePreviousImage}
          onNext={handleNextImage}
          hasPrevious={previewIndex > 0}
          hasNext={previewIndex < images.length - 1}
        />
      )}
    </>
  )
}
