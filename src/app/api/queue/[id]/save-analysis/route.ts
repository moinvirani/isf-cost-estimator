/**
 * Save Analysis API Route
 *
 * POST /api/queue/[id]/save-analysis
 *
 * Saves the analysis results for a lead so they persist
 * when the user leaves and comes back.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { SavedProductGroup } from '@/types/queue'

interface SaveAnalysisRequest {
  productGroups: SavedProductGroup[]
}

interface SaveAnalysisResponse {
  success: boolean
  error?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SaveAnalysisResponse>> {
  try {
    const supabase = getSupabaseClient()
    const { id } = await params
    const body: SaveAnalysisRequest = await request.json()

    if (!body.productGroups) {
      return NextResponse.json(
        { success: false, error: 'productGroups is required' },
        { status: 400 }
      )
    }

    // Update the lead with the analysis results
    const { error } = await supabase
      .from('zoko_leads')
      .update({
        analysis_result: body.productGroups,
        status: 'analyzed', // Update status to show it's been analyzed
      })
      .eq('id', id)

    if (error) {
      console.error('[SaveAnalysis] Supabase error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SaveAnalysis] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
