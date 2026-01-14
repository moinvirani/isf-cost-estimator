/**
 * Queue API Route
 *
 * GET /api/queue
 *
 * Fetches leads from the queue with optional filters.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import { requireAuth } from '@/lib/supabase/api-auth'
import type { QueueListResponse, ZokoLead, LeadStatus } from '@/types/queue'

export async function GET(request: NextRequest): Promise<NextResponse<QueueListResponse>> {
  // Require authentication
  const { error: authError } = await requireAuth(request)
  if (authError) return authError as NextResponse<QueueListResponse>

  try {
    const supabase = getSupabaseClient()
    const { searchParams } = new URL(request.url)

    // Parse query params
    const status = searchParams.get('status') as LeadStatus | 'all' | null
    const claimedBy = searchParams.get('claimedBy')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let query = supabase
      .from('zoko_leads')
      .select('*', { count: 'exact' })

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (claimedBy) {
      query = query.eq('claimed_by', claimedBy)
    }

    // Order by first_image_at (most recent first) for new leads
    // Order by claimed_at for claimed leads
    query = query
      .order('first_image_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[Queue] Error fetching leads:', error)
      return NextResponse.json(
        { success: false, leads: [], total: 0, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      leads: (data || []) as ZokoLead[],
      total: count || 0,
    })
  } catch (error) {
    console.error('[Queue] Error:', error)
    return NextResponse.json(
      {
        success: false,
        leads: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
