/**
 * Customer Profile API Route
 *
 * GET /api/customer/profile - Get customer profile
 * PUT /api/customer/profile - Update customer profile
 *
 * Requires customer authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import { requireCustomerAuth } from '@/lib/customer-auth'
import type { ProfileResponse, UpdateProfileRequest } from '@/types/customer'

/**
 * GET - Get customer profile
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ProfileResponse>> {
  // Require authentication
  const { customer, error } = await requireCustomerAuth(request)
  if (error) return error as NextResponse<ProfileResponse>

  return NextResponse.json({
    success: true,
    customer: {
      id: customer!.id,
      phone: customer!.phone,
      email: customer!.email,
      name: customer!.name,
    },
  })
}

/**
 * PUT - Update customer profile
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<ProfileResponse>> {
  // Require authentication
  const { customer, error } = await requireCustomerAuth(request)
  if (error) return error as NextResponse<ProfileResponse>

  try {
    const body: UpdateProfileRequest = await request.json()

    // Validate email format if provided
    if (body.email && !isValidEmail(body.email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Build update object (only include provided fields)
    const updates: Record<string, string> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.email !== undefined) updates.email = body.email

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update in database
    const supabase = getSupabaseClient()
    const { data: updated, error: dbError } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customer!.id)
      .select()
      .single()

    if (dbError) {
      console.error('[Profile] Update error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      customer: {
        id: updated.id,
        phone: updated.phone,
        email: updated.email,
        name: updated.name,
      },
    })
  } catch (error) {
    console.error('[Profile] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
