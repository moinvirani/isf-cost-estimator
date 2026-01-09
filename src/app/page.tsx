'use client'

/**
 * ISF Cost Estimator - Main Page
 *
 * This is the main workflow page where staff:
 * 1. Upload customer photos
 * 2. Review AI analysis
 * 3. Select services
 * 4. Generate draft order
 */

import { useState } from 'react'
import { ImageUpload } from '@/components/estimation'
import { uploadImages } from '@/lib/supabase/storage'

// Type for our uploaded images (before Supabase upload)
interface LocalImage {
  id: string
  file: File
  previewUrl: string
}

// Type for images after Supabase upload
interface UploadedImage {
  id: string
  url: string
  path: string
}

export default function Home() {
  const [localImages, setLocalImages] = useState<LocalImage[]>([])
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Handle image selection (local preview)
  const handleImagesChange = (images: LocalImage[]) => {
    setLocalImages(images)
    setUploadError(null)
  }

  // Handle upload to Supabase
  const handleUpload = async () => {
    if (localImages.length === 0) return

    setIsUploading(true)
    setUploadError(null)

    try {
      // Upload all images to Supabase Storage
      const files = localImages.map((img) => img.file)
      const results = await uploadImages(files)

      // Map results to our format
      const uploaded: UploadedImage[] = results.map((result, index) => ({
        id: localImages[index].id,
        url: result.url,
        path: result.path,
      }))

      setUploadedImages(uploaded)

      // Clear local images (they're now uploaded)
      setLocalImages([])

      console.log('Upload successful:', uploaded)
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadError(
        error instanceof Error ? error.message : 'Upload failed. Please try again.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const hasLocalImages = localImages.length > 0
  const hasUploadedImages = uploadedImages.length > 0

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-900">
            ISF Cost Estimator
          </h1>
          <p className="text-sm text-gray-500">
            Upload photos to get service recommendations
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Step 1: Upload Images */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Step 1: Upload Photos
          </h2>

          <ImageUpload
            onImagesChange={handleImagesChange}
            maxImages={10}
          />

          {/* Upload Button */}
          {hasLocalImages && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className={`
                  flex-1 py-3 px-4 rounded-lg font-medium text-white
                  transition-colors
                  ${isUploading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }
                `}
              >
                {isUploading ? 'Uploading...' : `Upload ${localImages.length} Image${localImages.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {uploadError}
            </div>
          )}
        </section>

        {/* Step 2: Uploaded Images (after upload) */}
        {hasUploadedImages && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Step 2: Review Items
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {uploadedImages.map((image) => (
                <div
                  key={image.id}
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
                >
                  <img
                    src={image.url}
                    alt="Uploaded item"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            <p className="mt-4 text-sm text-gray-500">
              {uploadedImages.length} image{uploadedImages.length !== 1 ? 's' : ''} uploaded.
              AI analysis coming soon!
            </p>
          </section>
        )}

        {/* Coming Soon: AI Analysis */}
        {hasUploadedImages && (
          <section className="bg-gray-100 rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-gray-500 text-sm">
              🚧 AI analysis will appear here in the next phase
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
