'use client'

/**
 * Image Upload Component
 *
 * A mobile-friendly component for uploading photos.
 * Supports:
 * - Camera capture (mobile)
 * - Drag & drop (desktop)
 * - File picker (all devices)
 */

import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, ImagePlus, Link } from 'lucide-react'

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']

interface UploadedImage {
  id: string
  file?: File           // Optional - may be URL-based
  previewUrl: string
  sourceUrl?: string    // Original URL if loaded from URL
}

interface ImageUploadProps {
  onImagesChange: (images: UploadedImage[]) => void
  maxImages?: number
}

export function ImageUpload({ onImagesChange, maxImages = 10 }: ImageUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Validate a file before adding
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type: ${file.type}. Use JPG, PNG, or HEIC.`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max is 10MB.`
    }
    return null
  }

  // Add files to the list
  const addFiles = useCallback((files: FileList | File[]) => {
    setError(null)
    const fileArray = Array.from(files)

    // Check if adding would exceed max
    if (images.length + fileArray.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`)
      return
    }

    const newImages: UploadedImage[] = []

    for (const file of fileArray) {
      // Validate
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        continue
      }

      // Create preview URL and add to list
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      const previewUrl = URL.createObjectURL(file)

      newImages.push({ id, file, previewUrl })
    }

    if (newImages.length > 0) {
      const updated = [...images, ...newImages]
      setImages(updated)
      onImagesChange(updated)
    }
  }, [images, maxImages, onImagesChange])

  // Remove an image
  const removeImage = useCallback((id: string) => {
    const updated = images.filter((img) => img.id !== id)
    // Revoke the blob URL to free memory (only for file-based images, not URL-based)
    const removed = images.find((img) => img.id === id)
    if (removed && removed.file && !removed.sourceUrl) {
      URL.revokeObjectURL(removed.previewUrl)
    }
    setImages(updated)
    onImagesChange(updated)
  }, [images, onImagesChange])

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  // Add image from URL
  const addImageFromUrl = useCallback(async (url: string) => {
    setError(null)

    // Basic URL validation
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('Please enter a URL')
      return
    }

    // Check if it looks like a URL
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setError('URL must start with http:// or https://')
      return
    }

    // Check if we've hit max images
    if (images.length >= maxImages) {
      setError(`Maximum ${maxImages} images allowed`)
      return
    }

    setUrlLoading(true)
    try {
      // Create a new image to verify the URL works
      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image from URL'))
        img.src = trimmedUrl
      })

      // URL works, add it to our list
      const id = `url-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

      const newImage: UploadedImage = {
        id,
        previewUrl: trimmedUrl,
        sourceUrl: trimmedUrl,
      }

      const updated = [...images, newImage]
      setImages(updated)
      onImagesChange(updated)
      setUrlInput('')
      setShowUrlInput(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image from URL')
    } finally {
      setUrlLoading(false)
    }
  }, [images, maxImages, onImagesChange])

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files)
    }
  }

  const hasImages = images.length > 0

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6
          transition-colors cursor-pointer
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-3 bg-white rounded-full shadow-sm">
            <ImagePlus className="w-8 h-8 text-gray-400" />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">
              Drop images here or tap to browse
            </p>
            <p className="text-xs text-gray-500 mt-1">
              JPG, PNG, HEIC up to 10MB each
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {/* Camera Button (mobile) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                cameraInputRef.current?.click()
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Camera
            </button>

            {/* Upload Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Browse
            </button>

            {/* URL Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowUrlInput(!showUrlInput)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              <Link className="w-4 h-4" />
              URL
            </button>
          </div>

          {/* URL Input Field */}
          {showUrlInput && (
            <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addImageFromUrl(urlInput)
                  }
                }}
                placeholder="Paste image URL here..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => addImageFromUrl(urlInput)}
                disabled={urlLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                  urlLoading ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {urlLoading ? 'Loading...' : 'Add'}
              </button>
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Image Previews */}
      {hasImages && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {images.length} image{images.length !== 1 ? 's' : ''} selected
            </p>
            {images.length < maxImages && (
              <p className="text-xs text-gray-500">
                {maxImages - images.length} more allowed
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
              >
                <img
                  src={image.previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
