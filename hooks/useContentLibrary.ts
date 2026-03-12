'use client'

import { useState, useEffect, useCallback } from 'react'
import { ContentProject } from '@/types/youtube'
import { authFetch } from '@/lib/api-client'

function mapRow(r: Record<string, unknown>): ContentProject {
  return {
    id: r.id as string,
    title: r.title as string,
    sourceVideoTitle: r.source_video_title as string,
    sourceVideoUrl: r.source_video_url as string,
    script: r.script as string,
    presentation: r.presentation as string,
    titles: (r.titles as string[]) || [],
    savedAt: r.saved_at as string,
  }
}

export function useContentLibrary() {
  const [projects, setProjects] = useState<ContentProject[]>([])

  useEffect(() => {
    authFetch('/api/content-projects')
      .then(res => res.ok ? res.json() : [])
      .then((rows: Record<string, unknown>[]) => setProjects(rows.map(mapRow)))
      .catch(() => {})
  }, [])

  const saveProject = useCallback((project: Omit<ContentProject, 'id' | 'savedAt'>): string => {
    const tempId = crypto.randomUUID()
    const optimistic: ContentProject = {
      ...project,
      id: tempId,
      savedAt: new Date().toISOString(),
    }
    setProjects(prev => [optimistic, ...prev])

    authFetch('/api/content-projects', {
      method: 'POST',
      body: JSON.stringify(project),
    })
      .then(res => res.ok ? res.json() : null)
      .then((row: Record<string, unknown> | null) => {
        if (row) {
          setProjects(prev => prev.map(p => p.id === tempId ? mapRow(row) : p))
        }
      })
      .catch(() => {})

    return tempId
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))

    authFetch('/api/content-projects', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }, [])

  return { projects, saveProject, deleteProject }
}
