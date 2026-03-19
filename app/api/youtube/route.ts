import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/auth'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3'
const API_KEY = process.env.YOUTUBE_API_KEY

interface YouTubeChannelItem {
  id: string
  snippet: {
    title: string
    description: string
    customUrl: string
    thumbnails: { default: { url: string }; medium: { url: string }; high: { url: string } }
    publishedAt: string
    country?: string
  }
  statistics: {
    viewCount: string
    subscriberCount: string
    videoCount: string
    hiddenSubscriberCount: boolean
  }
  contentDetails: {
    relatedPlaylists: { uploads: string }
  }
}

interface PlaylistItem {
  contentDetails: { videoId: string }
  snippet: { publishedAt: string; title: string }
}

interface VideoDetailItem {
  id: string
  snippet: {
    publishedAt: string
    title: string
    description: string
    thumbnails: { default: { url: string }; medium?: { url: string }; high?: { url: string } }
  }
  statistics: {
    viewCount: string
    likeCount: string
    commentCount: string
  }
  contentDetails: {
    duration: string
  }
}

// Parse ISO 8601 duration (PT1H2M3S) to seconds
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')
  return hours * 3600 + minutes * 60 + seconds
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

// Fetch all playlist items with pagination
async function fetchAllPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = []
  let pageToken: string | undefined

  do {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
    }
    if (pageToken) params.pageToken = pageToken

    const res = await ytFetch('playlistItems', params)
    items.push(...(res.items || []))
    pageToken = res.nextPageToken
  } while (pageToken)

  return items
}

// Fetch video details in batches of 50
async function fetchVideoDetails(videoIds: string[]): Promise<VideoDetailItem[]> {
  const results: VideoDetailItem[] = []

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const res = await ytFetch('videos', {
      part: 'snippet,statistics,contentDetails',
      id: batch.join(','),
    })
    results.push(...(res.items || []))
  }

  return results
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

    // Step 2: Get ALL uploads from the uploads playlist
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads
    const playlistItems = await fetchAllPlaylistItems(uploadsPlaylistId)

    // Step 3: Get detailed stats + duration for all videos
    const videoIds = playlistItems.map(item => item.contentDetails.videoId)
    const videoDetails = await fetchVideoDetails(videoIds)

    // Step 4: Build video list with type detection
    const videos = videoDetails.map(v => {
      const durationSeconds = parseDuration(v.contentDetails.duration)
      // Shorts are ≤ 60 seconds
      const videoType: 'short' | 'long' = durationSeconds <= 60 ? 'short' : 'long'

      return {
        id: v.id,
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt,
        thumbnailUrl: v.snippet.thumbnails.medium?.url || v.snippet.thumbnails.default?.url,
        viewCount: parseInt(v.statistics.viewCount || '0'),
        likeCount: parseInt(v.statistics.likeCount || '0'),
        commentCount: parseInt(v.statistics.commentCount || '0'),
        durationSeconds,
        videoType,
      }
    })

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
      videos,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
