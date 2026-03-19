import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/auth'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3'
const API_KEY = process.env.YOUTUBE_API_KEY

interface YouTubeChannelSnippet {
  title: string
  description: string
  customUrl: string
  thumbnails: { default: { url: string }; medium: { url: string }; high: { url: string } }
  publishedAt: string
  country?: string
}

interface YouTubeChannelStatistics {
  viewCount: string
  subscriberCount: string
  videoCount: string
  hiddenSubscriberCount: boolean
}

interface YouTubeChannelContentDetails {
  relatedPlaylists: { uploads: string }
}

interface YouTubeChannelItem {
  id: string
  snippet: YouTubeChannelSnippet
  statistics: YouTubeChannelStatistics
  contentDetails: YouTubeChannelContentDetails
}

interface YouTubeVideoSnippet {
  publishedAt: string
  title: string
  description: string
  thumbnails: { default: { url: string }; medium: { url: string }; high: { url: string } }
}

interface YouTubeVideoStatistics {
  viewCount: string
  likeCount: string
  commentCount: string
}

interface YouTubeVideoItem {
  snippet: YouTubeVideoSnippet
  contentDetails: { videoId: string }
}

interface YouTubeVideoDetailItem {
  id: string
  snippet: YouTubeVideoSnippet
  statistics: YouTubeVideoStatistics
}

async function ytFetch(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${YT_API_BASE}/${endpoint}`)
  url.searchParams.set('key', API_KEY!)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`YouTube API error: ${res.status} ${err}`)
  }
  return res.json()
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { ok } = rateLimit(user.id)
  if (!ok) return rateLimitResponse()

  if (!API_KEY) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 })
  }

  const handle = req.nextUrl.searchParams.get('handle')
  const channelId = req.nextUrl.searchParams.get('channelId')

  if (!handle && !channelId) {
    return NextResponse.json({ error: 'handle or channelId is required' }, { status: 400 })
  }

  try {
    // Step 1: Resolve channel
    let channel: YouTubeChannelItem | null = null

    if (channelId) {
      const channelRes = await ytFetch('channels', {
        part: 'snippet,statistics,contentDetails',
        id: channelId,
      })
      channel = channelRes.items?.[0] || null
    } else if (handle) {
      // Try forHandle first (works for @handles)
      const cleanHandle = handle.replace('@', '')
      const channelRes = await ytFetch('channels', {
        part: 'snippet,statistics,contentDetails',
        forHandle: cleanHandle,
      })
      channel = channelRes.items?.[0] || null

      // Fallback: search for channel
      if (!channel) {
        const searchRes = await ytFetch('search', {
          part: 'snippet',
          q: cleanHandle,
          type: 'channel',
          maxResults: '1',
        })
        const searchId = searchRes.items?.[0]?.snippet?.channelId || searchRes.items?.[0]?.id?.channelId
        if (searchId) {
          const fallbackRes = await ytFetch('channels', {
            part: 'snippet,statistics,contentDetails',
            id: searchId,
          })
          channel = fallbackRes.items?.[0] || null
        }
      }
    }

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Step 2: Get recent uploads
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads
    const playlistRes = await ytFetch('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: '12',
    })

    const videoIds = (playlistRes.items as YouTubeVideoItem[])
      .map((item: YouTubeVideoItem) => item.contentDetails.videoId)
      .join(',')

    // Step 3: Get video statistics
    let videos: {
      id: string
      title: string
      publishedAt: string
      thumbnailUrl: string
      viewCount: number
      likeCount: number
      commentCount: number
    }[] = []

    if (videoIds) {
      const videosRes = await ytFetch('videos', {
        part: 'snippet,statistics',
        id: videoIds,
      })

      videos = (videosRes.items as YouTubeVideoDetailItem[]).map((v: YouTubeVideoDetailItem) => ({
        id: v.id,
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt,
        thumbnailUrl: v.snippet.thumbnails.medium?.url || v.snippet.thumbnails.default?.url,
        viewCount: parseInt(v.statistics.viewCount || '0'),
        likeCount: parseInt(v.statistics.likeCount || '0'),
        commentCount: parseInt(v.statistics.commentCount || '0'),
      }))
    }

    return NextResponse.json({
      channel: {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl,
        thumbnailUrl: channel.snippet.thumbnails.medium?.url || channel.snippet.thumbnails.default?.url,
        publishedAt: channel.snippet.publishedAt,
        subscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
        viewCount: parseInt(channel.statistics.viewCount || '0'),
        videoCount: parseInt(channel.statistics.videoCount || '0'),
        hiddenSubscriberCount: channel.statistics.hiddenSubscriberCount,
      },
      recentVideos: videos,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
