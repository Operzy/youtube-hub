'use client'

import { useState, useEffect, useCallback } from 'react'
import { VideoResult, SavedVideo } from '@/types/youtube'

const STORAGE_KEY = 'coachq-saved-videos'

function load(): SavedVideo[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persist(videos: SavedVideo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos))
}

export function useSavedVideos() {
  const [saved, setSaved] = useState<SavedVideo[]>([])

  useEffect(() => {
    setSaved(load())
  }, [])

  const saveVideo = useCallback((video: VideoResult) => {
    setSaved(prev => {
      if (prev.some(v => v.url === video.url)) return prev
      const next = [...prev, { ...video, savedAt: new Date().toISOString() }]
      persist(next)
      return next
    })
  }, [])

  const unsaveVideo = useCallback((url: string) => {
    setSaved(prev => {
      const next = prev.filter(v => v.url !== url)
      persist(next)
      return next
    })
  }, [])

  const isSaved = useCallback((url: string | null) => {
    if (!url) return false
    return saved.some(v => v.url === url)
  }, [saved])

  return { saved, saveVideo, unsaveVideo, isSaved }
}
