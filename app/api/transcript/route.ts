import { NextRequest, NextResponse } from 'next/server'
import { ApifyClient } from 'apify-client'
import { getAuthUser, unauthorized } from '@/lib/auth'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

/** Extracts a plain string from a field that may be a string or array of segment objects */
function extractText(val: unknown): string | null {
  if (typeof val === 'string' && val.trim()) return val.trim()
  if (Array.isArray(val) && val.length) {
    const joined = val
      .filter((s) => s != null)
      .map((s) => (typeof s === 'string' ? s : (s as Record<string, unknown>).text ?? ''))
      .filter(Boolean)
      .join(' ')
      .trim()
    return joined || null
  }
  return null
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { ok } = rateLimit(user.id)
  if (!ok) return rateLimitResponse()

  const { videoUrl } = await req.json()

  if (!videoUrl || typeof videoUrl !== 'string') {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
  }

  try {
    const run = await client.actor('karamelo/youtube-transcripts').call({
      urls: [videoUrl],
    })

    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    if (!items.length) {
      return NextResponse.json({ error: 'No transcript found for this video' }, { status: 404 })
    }

    const item = items[0] as Record<string, unknown>

    // Log full shape in dev so we can see what the actor returns
    if (process.env.NODE_ENV === 'development') {
      console.log('[transcript] output keys:', Object.keys(item))
      console.log('[transcript] sample:', JSON.stringify(item).slice(0, 800))
    }

    const transcript =
      extractText(item.transcript) ||
      extractText(item.text) ||
      extractText(item.captions) ||
      extractText(item.subtitles) ||
      extractText(item.transcriptSegments) ||
      null

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript field not found. Check server logs for output shape.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ transcript })
  } catch (err) {
    console.error('Transcript scrape error:', err)
    const message = err instanceof Error ? err.message : 'Scraping failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
