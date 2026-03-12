'use client'

import { useState, useEffect, useCallback } from 'react'
import { VideoResult, SavedVideo } from '@/types/youtube'
import { authFetch } from '@/lib/api-client'

export function useSavedVideos() {
  const [saved, setSaved] = useState<SavedVideo[]>([])

  useEffect(() => {
    authFetch('/api/saved-videos')
      .then(res => res.ok ? res.json() : [])
      .then((rows: Record<string, unknown>[]) => {
        setSaved(rows.map(r => ({
          title: r.title as string | null,
          url: r.url as string | null,
          viewCount: r.view_count as number | null,
          uploadDate: r.upload_date as string | null,
          thumbnailUrl: r.thumbnail_url as string | null,
          channelName: r.channel_name as string | null,
          description: r.description as string | null,
          subscriberCount: r.subscriber_count as number | null,
          type: (r.type as 'video' | 'shorts') || 'video',
          savedAt: r.saved_at as string,
        })))
      })
      .catch(() => {})
  }, [])

  const saveVideo = useCallback((video: VideoResult) => {
    if (saved.some(v => v.url === video.url)) return

    const optimistic: SavedVideo = { ...video, savedAt: new Date().toISOString() }
    setSaved(prev => [...prev, optimistic])

    authFetch('/api/saved-videos', {
      method: 'POST',
      body: JSON.stringify(video),
    }).catch(() => {
      setSaved(prev => prev.filter(v => v.url !== video.url))
    })
  }, [saved])

  const unsaveVideo = useCallback((url: string) => {
    setSaved(prev => prev.filter(v => v.url !== url))

    authFetch('/api/saved-videos', {
      method: 'DELETE',
      body: JSON.stringify({ url }),
    }).catch(() => {})
  }, [])

  const isSaved = useCallback((url: string | null) => {
    if (!url) return false
    return saved.some(v => v.url === url)
  }, [saved])

  return { saved, saveVideo, unsaveVideo, isSaved }
}
