/**
 * Single Estimation API Route
 *
 * GET /api/estimations/[id] - Get estimation details
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/estimations/[id]
 * Get single estimation with all items and services
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Fetch estimation with items and services
    const { data: estimation, error } = await supabase
      .from('estimations')
      .select(`
        *,
        estimation_items (
          *,
          item_services (*)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Estimation not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      estimation,
    })
  } catch (error) {
    console.error('Failed to fetch estimation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch estimation' },
      { status: 500 }
    )
  }
}
