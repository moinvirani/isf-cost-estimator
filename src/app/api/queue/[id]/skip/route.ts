/**
 * Skip Lead API Route
 *
 * POST /api/queue/[id]/skip
 *
 * Skips a lead (marks it as not actionable).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { QueueLeadResponse, SkipLeadRequest, ZokoLead } from '@/types/queue'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<QueueLeadResponse>> {
  try {
    const supabase = getSupabaseClient()
    const { id } = await params
    const body: SkipLeadRequest = await request.json()

    // Update the lead
    const { data, error } = await supabase
      .from('zoko_leads')
      .update({
        status: 'skipped',
        notes: body.reason || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      lead: data as ZokoLead,
    })
  } catch (error) {
    console.error('[Queue/Skip] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
