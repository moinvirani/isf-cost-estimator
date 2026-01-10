/**
 * Training Examples API
 *
 * POST /api/training/examples - Save a new training example
 * GET /api/training/examples - Fetch verified training examples (for AI prompt)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { SaveTrainingExampleRequest, TrainingExample } from '@/types/training'

// Create Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST - Save a new training example
 */
export async function POST(request: NextRequest) {
  try {
    const body: SaveTrainingExampleRequest = await request.json()

    // Validate required fields
    if (!body.image_url) {
      return NextResponse.json(
        { success: false, error: 'image_url is required' },
        { status: 400 }
      )
    }

    if (!body.correct_services || body.correct_services.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one correct_service is required' },
        { status: 400 }
      )
    }

    // Insert into database
    const { data, error } = await supabase
      .from('training_examples')
      .insert({
        image_url: body.image_url,
        image_source: body.image_source || 'manual',
        zoko_customer_id: body.zoko_customer_id,
        zoko_message_id: body.zoko_message_id,
        zoko_customer_name: body.zoko_customer_name,
        ai_category: body.ai_category,
        ai_sub_type: body.ai_sub_type,
        ai_material: body.ai_material,
        ai_condition: body.ai_condition,
        ai_issues: body.ai_issues || [],
        correct_services: body.correct_services,
        verified_by: body.verified_by,
        verified_at: new Date().toISOString(),
        notes: body.notes,
        status: 'verified',
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      example: data,
    })
  } catch (error) {
    console.error('Error saving training example:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save' },
      { status: 500 }
    )
  }
}

/**
 * GET - Fetch verified training examples
 * Used to build few-shot examples for AI prompt
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category') // Optional filter
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = supabase
      .from('training_examples')
      .select('*')
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (category) {
      query = query.eq('ai_category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      examples: data as TrainingExample[],
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('Error fetching training examples:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch' },
      { status: 500 }
    )
  }
}
