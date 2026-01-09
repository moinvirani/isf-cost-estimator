/**
 * Supabase Storage Functions
 *
 * Functions for uploading and managing images in Supabase Storage.
 */

import { supabase } from './client'

const BUCKET_NAME = 'item-images'

/**
 * Generate a unique filename for an uploaded image
 *
 * Format: {timestamp}-{random}.{extension}
 * Example: 1704825600000-a1b2c3.jpg
 */
function generateFileName(file: File): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  return `${timestamp}-${random}.${extension}`
}

/**
 * Upload a single image to Supabase Storage
 *
 * @param file - The File object to upload
 * @returns Object with path (for deletion) and url (for display)
 */
export async function uploadImage(file: File): Promise<{
  path: string
  url: string
}> {
  const fileName = generateFileName(file)
  const filePath = `uploads/${fileName}`

  // Upload the file
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600', // Cache for 1 hour
      upsert: false,        // Don't overwrite if exists
    })

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`)
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath)

  return {
    path: data.path,
    url: urlData.publicUrl,
  }
}

/**
 * Upload multiple images
 *
 * @param files - Array of File objects
 * @returns Array of upload results (path and url for each)
 */
export async function uploadImages(files: File[]): Promise<{
  path: string
  url: string
}[]> {
  const results = await Promise.all(
    files.map((file) => uploadImage(file))
  )
  return results
}

/**
 * Delete an image from Supabase Storage
 *
 * @param path - The storage path (from uploadImage result)
 */
export async function deleteImage(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path])

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`)
  }
}

/**
 * Delete multiple images
 *
 * @param paths - Array of storage paths
 */
export async function deleteImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(paths)

  if (error) {
    throw new Error(`Failed to delete images: ${error.message}`)
  }
}
