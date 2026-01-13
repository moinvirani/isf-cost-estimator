'use client'

/**
 * Annotated Image Viewer Component
 *
 * Displays images with issue annotations overlaid as circles.
 * Features:
 * - Click to open full-screen modal
 * - Pinch-to-zoom on mobile
 * - SVG overlay with circles at issue locations
 * - Color-coded by severity (yellow/orange/red)
 * - Download annotated image for sharing
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { DetectedIssue } from '@/types/item'

// Severity colors
const severityColors = {
  minor: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)', text: '#b45309' },
  moderate: { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.2)', text: '#c2410c' },
  severe: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.2)', text: '#b91c1c' },
}

interface AnnotatedImageViewerProps {
  images: { id: string; url: string }[]
  issues: DetectedIssue[]
  currentImageIndex?: number
  onImageChange?: (index: number) => void
}

export function AnnotatedImageViewer({
  images,
  issues,
  currentImageIndex = 0,
  onImageChange,
}: AnnotatedImageViewerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalImageIndex, setModalImageIndex] = useState(currentImageIndex)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  // Natural image dimensions (original size)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  // Displayed image dimensions (actual rendered size)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Get issues for current image
  const currentIssues = issues.filter(
    (issue) => (issue.bbox?.imageIndex ?? 0) === modalImageIndex
  )

  // Reset zoom/pan when modal opens or image changes
  useEffect(() => {
    if (isModalOpen) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }, [isModalOpen, modalImageIndex])

  // Update display size when image loads or window resizes
  const updateDisplaySize = useCallback(() => {
    const img = imageRef.current
    if (!img) return

    // Get the actual rendered dimensions of the image
    const rect = img.getBoundingClientRect()
    setDisplaySize({ width: rect.width, height: rect.height })
  }, [])

  // Handle image load to get dimensions
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })

    // Wait for layout to settle, then get display size
    requestAnimationFrame(() => {
      const rect = img.getBoundingClientRect()
      setDisplaySize({ width: rect.width, height: rect.height })
    })
  }, [])

  // Update display size on resize
  useEffect(() => {
    if (!isModalOpen) return

    const handleResize = () => {
      requestAnimationFrame(updateDisplaySize)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isModalOpen, updateDisplaySize])

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
      // Pinch start - calculate initial distance
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      ;(e.currentTarget as HTMLElement).dataset.pinchStart = String(distance)
      ;(e.currentTarget as HTMLElement).dataset.scaleStart = String(scale)
    } else if (e.touches.length === 1 && scale > 1) {
      // Pan start
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      })
    }
  }, [scale, position])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
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
      // Pan
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

  // Download annotated image
  const handleDownload = useCallback(async () => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img || naturalSize.width === 0) return

    // Set canvas size to natural image size
    canvas.width = naturalSize.width
    canvas.height = naturalSize.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw image
    ctx.drawImage(img, 0, 0, naturalSize.width, naturalSize.height)

    // Draw annotations
    currentIssues.forEach((issue, index) => {
      if (!issue.bbox) return

      const colors = severityColors[issue.severity]
      const x = issue.bbox.x * naturalSize.width
      const y = issue.bbox.y * naturalSize.height
      const width = issue.bbox.width * naturalSize.width
      const height = issue.bbox.height * naturalSize.height

      // Calculate circle center and radius
      const centerX = x + width / 2
      const centerY = y + height / 2
      const radius = Math.max(width, height) / 2 + 30

      // Draw circle
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.strokeStyle = colors.stroke
      ctx.lineWidth = 6
      ctx.stroke()
      ctx.fillStyle = colors.fill
      ctx.fill()

      // Draw number label
      const labelX = centerX + radius * 0.7
      const labelY = centerY - radius * 0.7
      const labelRadius = 30

      ctx.beginPath()
      ctx.arc(labelX, labelY, labelRadius, 0, 2 * Math.PI)
      ctx.fillStyle = colors.stroke
      ctx.fill()

      ctx.fillStyle = 'white'
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(index + 1), labelX, labelY)

      // Draw issue type label below circle
      const labelText = issue.type.replace(/_/g, ' ')
      ctx.fillStyle = colors.stroke
      ctx.font = 'bold 20px Arial'
      ctx.fillText(labelText, centerX, centerY + radius + 30)
    })

    // Trigger download
    const link = document.createElement('a')
    link.download = `isf-analysis-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [naturalSize, currentIssues])

  // Navigate images in modal
  const goToImage = (index: number) => {
    setModalImageIndex(index)
    onImageChange?.(index)
  }

  if (images.length === 0) return null

  return (
    <>
      {/* Thumbnail gallery with annotations preview */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {images.map((image, idx) => {
          const issuesForImage = issues.filter(
            (issue) => (issue.bbox?.imageIndex ?? 0) === idx
          )
          const hasIssues = issuesForImage.length > 0

          return (
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
              {/* Issue count badge */}
              {hasIssues && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {issuesForImage.length}
                </span>
              )}
              {/* Image number */}
              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
                {idx + 1}
              </span>
            </button>
          )
        })}
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
              {currentIssues.length > 0 && ` - ${currentIssues.length} issue${currentIssues.length !== 1 ? 's' : ''}`}
            </span>

            <button
              onClick={handleDownload}
              className="text-white p-2 rounded-full hover:bg-white/10 flex items-center gap-1"
              title="Download annotated image"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
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
              {/* Image wrapper - this is the key fix! Position SVG relative to this */}
              <div className="relative inline-block">
                {/* Main image */}
                <img
                  ref={imageRef}
                  src={images[modalImageIndex].url}
                  alt={`Image ${modalImageIndex + 1}`}
                  className="max-w-full max-h-[calc(100vh-200px)] object-contain"
                  onLoad={handleImageLoad}
                  crossOrigin="anonymous"
                  draggable={false}
                />

                {/* SVG overlay - now positioned relative to the image wrapper */}
                {displaySize.width > 0 && naturalSize.width > 0 && (
                  <svg
                    className="absolute top-0 left-0 pointer-events-none"
                    width={displaySize.width}
                    height={displaySize.height}
                    viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {currentIssues.map((issue, index) => {
                      if (!issue.bbox) return null

                      const colors = severityColors[issue.severity]
                      // bbox coordinates are normalized (0-1), convert to natural image pixels
                      const x = issue.bbox.x * naturalSize.width
                      const y = issue.bbox.y * naturalSize.height
                      const width = issue.bbox.width * naturalSize.width
                      const height = issue.bbox.height * naturalSize.height

                      // Circle center and radius
                      const centerX = x + width / 2
                      const centerY = y + height / 2
                      const radius = Math.max(width, height) / 2 + 30

                      return (
                        <g key={index}>
                          {/* Circle around issue */}
                          <circle
                            cx={centerX}
                            cy={centerY}
                            r={radius}
                            stroke={colors.stroke}
                            strokeWidth="6"
                            fill={colors.fill}
                          />
                          {/* Number label */}
                          <circle
                            cx={centerX + radius * 0.7}
                            cy={centerY - radius * 0.7}
                            r="24"
                            fill={colors.stroke}
                          />
                          <text
                            x={centerX + radius * 0.7}
                            y={centerY - radius * 0.7}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="white"
                            fontSize="18"
                            fontWeight="bold"
                          >
                            {index + 1}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                )}
              </div>
            </div>

            {/* Hidden canvas for download */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Issue legend */}
          {currentIssues.length > 0 && (
            <div className="bg-black/80 p-4 overflow-x-auto">
              <div className="flex gap-3 min-w-max">
                {currentIssues.map((issue, index) => {
                  const colors = severityColors[issue.severity]
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: colors.fill, border: `2px solid ${colors.stroke}` }}
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: colors.stroke }}
                      >
                        {index + 1}
                      </span>
                      <span className="text-white text-sm font-medium capitalize">
                        {issue.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-white/70 text-xs">
                        ({issue.location.replace(/_/g, ' ')})
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
          <div className="absolute bottom-28 right-4 flex flex-col gap-2">
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
