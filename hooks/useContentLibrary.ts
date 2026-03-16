'use client'

import { useState, useEffect, useCallback } from 'react'
import { ContentProject, ScoreItem, ComparisonResult } from '@/types/youtube'
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
    sourceTranscript: (r.source_transcript as string) || undefined,
    sourceScores: (r.source_scores as ScoreItem[]) || undefined,
    myVideoUrl: (r.my_video_url as string) || undefined,
    myVideoTitle: (r.my_video_title as string) || undefined,
    myTranscript: (r.my_transcript as string) || undefined,
    myScores: (r.my_scores as ScoreItem[]) || undefined,
    comparisonResult: (r.comparison_result as ComparisonResult) || undefined,
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

  const updateProject = useCallback(async (id: string, fields: Partial<ContentProject>) => {
    // Optimistic update
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p))

    // Convert camelCase to snake_case for the API
    const body: Record<string, unknown> = { id }
    if (fields.myVideoUrl !== undefined) body.my_video_url = fields.myVideoUrl
    if (fields.myVideoTitle !== undefined) body.my_video_title = fields.myVideoTitle
    if (fields.myTranscript !== undefined) body.my_transcript = fields.myTranscript
    if (fields.myScores !== undefined) body.my_scores = fields.myScores
    if (fields.comparisonResult !== undefined) body.comparison_result = fields.comparisonResult
    if (fields.sourceTranscript !== undefined) body.source_transcript = fields.sourceTranscript
    if (fields.sourceScores !== undefined) body.source_scores = fields.sourceScores

    try {
      const res = await authFetch('/api/content-projects', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const row = await res.json()
        setProjects(prev => prev.map(p => p.id === id ? mapRow(row) : p))
      }
    } catch {
      // Revert on failure would be ideal but keep simple for now
    }
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))

    authFetch('/api/content-projects', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }, [])

  return { projects, saveProject, updateProject, deleteProject }
}
