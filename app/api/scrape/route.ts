import { NextRequest, NextResponse } from 'next/server'
import { ApifyClient } from 'apify-client'
import { VideoResult } from '@/types/youtube'

const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

export async function POST(req: NextRequest) {
  const {
    keyword,
    maxResults = 20,
    sortBy = 'views',
    dateFilter = 'month',
    contentType = 'videos',
    lengthFilter,
  } = await req.json()

  if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json({ error: 'APIFY_TOKEN is not configured' }, { status: 500 })
  }

  const allowedSortBy = ['relevance', 'date', 'views', 'rating']
  const allowedDateFilter = ['hour', 'today', 'week', 'month', 'year']
  const allowedLengthFilter = ['under4', 'between420', 'plus20']

  // The actor uses separate maxResults params for videos, shorts, and streams
  const cap = Math.min(Number(maxResults), 50)
  const maxVideos = contentType === 'videos' || contentType === 'all' ? cap : 0
  const maxShorts = contentType === 'shorts' || contentType === 'all' ? cap : 0
  const maxStreams = contentType === 'streams' || contentType === 'all' ? cap : 0

  try {
    const input: Record<string, unknown> = {
      searchQueries: [keyword.trim()],
      maxResults: maxVideos,
      maxResultsShorts: maxShorts,
      maxResultStreams: maxStreams,
      sortingOrder: allowedSortBy.includes(sortBy) ? sortBy : 'views',
    }

    // Only set dateFilter if provided (actor treats null as "any time")
    if (dateFilter && allowedDateFilter.includes(dateFilter)) {
      input.dateFilter = dateFilter
    }

    // Only set lengthFilter if provided
    if (lengthFilter && allowedLengthFilter.includes(lengthFilter)) {
      input.lengthFilter = lengthFilter
    }

    const run = await client.actor('streamers/youtube-scraper').call(input)

    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    const videos: VideoResult[] = items.map((item: Record<string, unknown>) => ({
      title: (item.title as string) ?? null,
      url: (item.url as string) ?? null,
      viewCount: (item.viewCount as number) ?? null,
      uploadDate: (item.date as string) ?? null,
      thumbnailUrl: (item.thumbnailUrl as string) ?? null,
      channelName: (item.channelName as string) ?? null,
      description: (item.text as string) ?? null,
      subscriberCount: (item.numberOfSubscribers as number) ?? null,
      type: (item.type as string) === 'shorts' ? 'shorts' : 'video',
    }))

    return NextResponse.json({ videos, keyword: keyword.trim() })
  } catch (err) {
    console.error('Apify scrape error:', err)
    const message = err instanceof Error ? err.message : 'Scraping failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
