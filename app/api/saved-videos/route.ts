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
    .from('saved_videos')
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

  const video = await req.json()
  const supabase = createServerSupabase(req)

  const { data, error } = await supabase
    .from('saved_videos')
    .upsert({
      user_id: user.id,
      title: video.title,
      url: video.url,
      view_count: video.viewCount,
      upload_date: video.uploadDate,
      thumbnail_url: video.thumbnailUrl,
      channel_name: video.channelName,
      description: video.description,
      subscriber_count: video.subscriberCount,
      type: video.type || 'video',
    }, { onConflict: 'user_id,url' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  const supabase = createServerSupabase(req)
  const { error } = await supabase
    .from('saved_videos')
    .delete()
    .eq('url', url)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
