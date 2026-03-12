'use client'

import { useState, useEffect, useCallback } from 'react'
import { CalendarEntry } from '@/types/youtube'

const STORAGE_KEY = 'coachq-calendar'

function load(): CalendarEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persist(entries: CalendarEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function useCalendar() {
  const [entries, setEntries] = useState<CalendarEntry[]>([])

  useEffect(() => {
    setEntries(load())
  }, [])

  const addEntry = useCallback((entry: Omit<CalendarEntry, 'id'>) => {
    setEntries(prev => {
      const next = [...prev, { ...entry, id: crypto.randomUUID() }]
      persist(next)
      return next
    })
  }, [])

  const updateEntry = useCallback((id: string, patch: Partial<CalendarEntry>) => {
    setEntries(prev => {
      const next = prev.map(e => (e.id === id ? { ...e, ...patch } : e))
      persist(next)
      return next
    })
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id)
      persist(next)
      return next
    })
  }, [])

  return { entries, addEntry, updateEntry, deleteEntry }
}
