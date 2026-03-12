'use client'

import { useState, useEffect, useCallback } from 'react'
import { ContentProject } from '@/types/youtube'

const STORAGE_KEY = 'coach-q-content-library'

export function useContentLibrary() {
  const [projects, setProjects] = useState<ContentProject[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setProjects(JSON.parse(raw))
    } catch { /* empty */ }
  }, [])

  function persist(next: ContentProject[]) {
    setProjects(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const saveProject = useCallback((project: Omit<ContentProject, 'id' | 'savedAt'>) => {
    const entry: ContentProject = {
      ...project,
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
    }
    setProjects(prev => {
      const next = [entry, ...prev]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
    return entry.id
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { projects, saveProject, deleteProject }
}
