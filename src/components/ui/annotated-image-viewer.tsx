'use client'

/**
 * Image Viewer Component
 *
 * Displays images with full-screen modal view.
 * Features:
 * - Thumbnail gallery
 * - Click to open full-screen modal
 * - Pinch-to-zoom on mobile
 * - Navigation between images
 */

import { useState, useRef, useCallback, useEffect } from 'react'

interface ImageViewerProps {
  images: { id: string; url: string }[]
  currentImageIndex?: number
  onImageChange?: (index: number) => void
}

export function AnnotatedImageViewer({
  images,
  currentImageIndex = 0,
  onImageChange,
}: ImageViewerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalImageIndex, setModalImageIndex] = useState(currentImageIndex)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset zoom/pan when modal opens or image changes
  useEffect(() => {
    if (isModalOpen) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }, [isModalOpen, modalImageIndex])

  // Handle thumbnail click
  const handleThumbnailClick = (index: number) => {
    setModalImageIndex(index)
    setIsModalOpen(true)
    onImageChange?.(index)
  }

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((prev) => Math.min(Math.max(prev * delta, 0.5), 5))
  }, [])

  // Handle pinch zoom for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      ;(e.currentTarget as HTMLElement).dataset.pinchStart = String(distance)
      ;(e.currentTarget as HTMLElement).dataset.scaleStart = String(scale)
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      })
    }
  }, [scale, position])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      const startDistance = Number((e.currentTarget as HTMLElement).dataset.pinchStart)
      const startScale = Number((e.currentTarget as HTMLElement).dataset.scaleStart)
      if (startDistance && startScale) {
        const newScale = (distance / startDistance) * startScale
        setScale(Math.min(Math.max(newScale, 0.5), 5))
      }
    } else if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      })
    }
  }, [isDragging, dragStart])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Mouse drag for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    }
  }, [scale, position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Navigate images in modal
  const goToImage = (index: number) => {
    setModalImageIndex(index)
    onImageChange?.(index)
  }

  if (images.length === 0) return null

  return (
    <>
      {/* Thumbnail gallery */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {images.map((image, idx) => (
          <button
            key={image.id}
            onClick={() => handleThumbnailClick(idx)}
            className={`
              relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden
              border-2 transition-all
              ${idx === currentImageIndex
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <img
              src={image.url}
              alt={`Image ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Image number */}
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
              {idx + 1}
            </span>
          </button>
        ))}
      </div>

      {/* Full-screen modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/80">
            <button
              onClick={() => setIsModalOpen(false)}
              className="text-white p-2 rounded-full hover:bg-white/10"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <span className="text-white font-medium">
              Image {modalImageIndex + 1} of {images.length}
            </span>

            <div className="w-10" /> {/* Spacer for alignment */}
          </div>

          {/* Image container with zoom/pan */}
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden relative"
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default' }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <img
                src={images[modalImageIndex].url}
                alt={`Image ${modalImageIndex + 1}`}
                className="max-w-full max-h-[calc(100vh-150px)] object-contain"
                draggable={false}
              />
            </div>
          </div>

          {/* Navigation dots */}
          {images.length > 1 && (
            <div className="bg-black/80 p-4 flex justify-center gap-2">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToImage(idx)}
                  className={`
                    w-3 h-3 rounded-full transition-all
                    ${idx === modalImageIndex
                      ? 'bg-white scale-125'
                      : 'bg-white/40 hover:bg-white/60'
                    }
                  `}
                  aria-label={`Go to image ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-20 right-4 flex flex-col gap-2">
            <button
              onClick={() => setScale((prev) => Math.min(prev * 1.3, 5))}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-xl font-bold"
            >
              +
            </button>
            <button
              onClick={() => setScale((prev) => Math.max(prev * 0.7, 0.5))}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-xl font-bold"
            >
              −
            </button>
            {scale !== 1 && (
              <button
                onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }) }}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-xs font-bold"
                title="Reset zoom"
              >
                1:1
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
