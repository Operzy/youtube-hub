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
    .from('content_projects')
    .select('*')
    .order('saved_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { ok } = rateLimit(user.id)
  if (!ok) return rateLimitResponse()

  const project = await req.json()
  const supabase = createServerSupabase(req)

  const { data, error } = await supabase
    .from('content_projects')
    .insert({
      user_id: user.id,
      title: project.title,
      source_video_title: project.sourceVideoTitle,
      source_video_url: project.sourceVideoUrl,
      script: project.script,
      presentation: project.presentation,
      titles: project.titles || [],
    })
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
    .from('content_projects')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
