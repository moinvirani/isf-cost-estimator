/**
 * Complete Lead API Route
 *
 * POST /api/queue/[id]/complete
 *
 * Marks a lead as completed (quoted/order sent).
 * Also saves training data for AI learning.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { QueueLeadResponse, CompleteLeadRequest, ZokoLead, ProductTrainingData } from '@/types/queue'

/**
 * Save training examples from completed lead
 */
async function saveTrainingData(
  leadId: string,
  customerName: string | null,
  trainingData: ProductTrainingData[]
): Promise<void> {
  const supabase = getSupabaseClient()
  for (const product of trainingData) {
    // Only save if we have both images and services
    if (!product.imageUrls.length || !product.services.length) {
      continue
    }

    // Save each image as a separate training example
    for (const imageUrl of product.imageUrls) {
      const trainingExample = {
        image_url: imageUrl,
        image_source: 'zoko',
        zoko_customer_name: customerName,
        ai_category: product.analysis?.category || null,
        ai_sub_type: product.analysis?.subType || null,
        ai_material: product.analysis?.material || null,
        ai_condition: product.analysis?.condition || null,
        ai_issues: product.analysis?.issues || [],
        correct_services: product.services.map(s => ({
          service_name: s.serviceName,
          service_id: s.serviceId,
        })),
        verified_by: 'Staff',
        verified_at: new Date().toISOString(),
        notes: `From lead ${leadId}`,
        status: 'verified',
      }

      const { error: insertError } = await supabase
        .from('training_examples')
        .insert(trainingExample)

      if (insertError) {
        console.error('[Training] Failed to save example:', insertError.message, insertError.details)
      } else {
        console.log('[Training] Saved example for image:', imageUrl.substring(0, 50) + '...')
      }
    }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<QueueLeadResponse>> {
  try {
    const supabase = getSupabaseClient()
    const { id } = await params
    const body: CompleteLeadRequest = await request.json()

    // First, fetch the lead to get customer info
    const { data: existingLead } = await supabase
      .from('zoko_leads')
      .select('customer_name')
      .eq('id', id)
      .single()

    // Update the lead
    const updateData: Record<string, unknown> = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    }

    // Add optional fields if provided
    if (body.estimationId) {
      updateData.estimation_id = body.estimationId
    }
    if (body.draftOrderId) {
      updateData.draft_order_id = body.draftOrderId
    }
    if (body.draftOrderUrl) {
      updateData.draft_order_url = body.draftOrderUrl
    }

    const { data, error } = await supabase
      .from('zoko_leads')
      .update(updateData)
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

    // Save training data if provided
    if (body.trainingData && body.trainingData.length > 0) {
      console.log(`[Queue/Complete] Received training data:`, JSON.stringify(body.trainingData, null, 2))
      await saveTrainingData(
        id,
        existingLead?.customer_name || null,
        body.trainingData
      )
      console.log(`[Queue/Complete] Saved ${body.trainingData.length} products as training data`)
    } else {
      console.log(`[Queue/Complete] No training data received. Body:`, JSON.stringify(body, null, 2))
    }

    return NextResponse.json({
      success: true,
      lead: data as ZokoLead,
    })
  } catch (error) {
    console.error('[Queue/Complete] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
