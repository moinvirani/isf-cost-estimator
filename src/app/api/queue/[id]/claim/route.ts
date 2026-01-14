/**
 * Claim Lead API Route
 *
 * POST /api/queue/[id]/claim
 *
 * Claims a lead for a team member.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { QueueLeadResponse, ClaimRequest, ZokoLead } from '@/types/queue'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<QueueLeadResponse>> {
  try {
    const supabase = getSupabaseClient()
    const { id } = await params
    const body: ClaimRequest = await request.json()

    if (!body.claimedBy) {
      return NextResponse.json(
        { success: false, error: 'claimedBy is required' },
        { status: 400 }
      )
    }

    // Check if lead exists and is unclaimed
    const { data: existing, error: fetchError } = await supabase
      .from('zoko_leads')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Check if already claimed by someone else
    if (existing.status === 'claimed' && existing.claimed_by !== body.claimedBy) {
      return NextResponse.json(
        { success: false, error: `Lead already claimed by ${existing.claimed_by}` },
        { status: 409 }
      )
    }

    // Claim the lead
    const { data, error } = await supabase
      .from('zoko_leads')
      .update({
        status: 'claimed',
        claimed_by: body.claimedBy,
        claimed_at: new Date().toISOString(),
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

    return NextResponse.json({
      success: true,
      lead: data as ZokoLead,
    })
  } catch (error) {
    console.error('[Queue/Claim] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
