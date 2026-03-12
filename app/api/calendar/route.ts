import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/auth'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { ok } = rateLimit(user.id)
  if (!ok) return rateLimitResponse()

  const supabase = createServerSupabase(req)
  const { data, error } = await supabase
    .from('calendar_entries')
    .select('*')
    .order('date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { ok } = rateLimit(user.id)
  if (!ok) return rateLimitResponse()

  const entry = await req.json()
  const supabase = createServerSupabase(req)

  const { data, error } = await supabase
    .from('calendar_entries')
    .insert({
      user_id: user.id,
      title: entry.title,
      date: entry.date,
      status: entry.status || 'idea',
      notes: entry.notes || '',
      source_url: entry.sourceUrl,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { id, ...patch } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = createServerSupabase(req)

  const update: Record<string, unknown> = {}
  if (patch.title !== undefined) update.title = patch.title
  if (patch.date !== undefined) update.date = patch.date
  if (patch.status !== undefined) update.status = patch.status
  if (patch.notes !== undefined) update.notes = patch.notes
  if (patch.sourceUrl !== undefined) update.source_url = patch.sourceUrl

  const { data, error } = await supabase
    .from('calendar_entries')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = createServerSupabase(req)
  const { error } = await supabase
    .from('calendar_entries')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
