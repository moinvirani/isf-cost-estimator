/**
 * Single Lead API Route
 *
 * GET /api/queue/[id]
 *
 * Fetches a single lead by ID.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { QueueLeadResponse, ZokoLead } from '@/types/queue'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<QueueLeadResponse>> {
  try {
    const supabase = getSupabaseClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('zoko_leads')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      lead: data as ZokoLead,
    })
  } catch (error) {
    console.error('[Queue/Get] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
