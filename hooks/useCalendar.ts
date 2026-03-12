'use client'

import { useState, useEffect, useCallback } from 'react'
import { CalendarEntry } from '@/types/youtube'
import { authFetch } from '@/lib/api-client'

function mapRow(r: Record<string, unknown>): CalendarEntry {
  return {
    id: r.id as string,
    title: r.title as string,
    date: r.date as string,
    status: r.status as CalendarEntry['status'],
    notes: (r.notes as string) || '',
    sourceUrl: r.source_url as string | undefined,
  }
}

export function useCalendar() {
  const [entries, setEntries] = useState<CalendarEntry[]>([])

  useEffect(() => {
    authFetch('/api/calendar')
      .then(res => res.ok ? res.json() : [])
      .then((rows: Record<string, unknown>[]) => setEntries(rows.map(mapRow)))
      .catch(() => {})
  }, [])

  const addEntry = useCallback((entry: Omit<CalendarEntry, 'id'>) => {
    const tempId = crypto.randomUUID()
    setEntries(prev => [...prev, { ...entry, id: tempId }])

    authFetch('/api/calendar', {
      method: 'POST',
      body: JSON.stringify(entry),
    })
      .then(res => res.ok ? res.json() : null)
      .then((row: Record<string, unknown> | null) => {
        if (row) {
          setEntries(prev => prev.map(e => e.id === tempId ? mapRow(row) : e))
        }
      })
      .catch(() => {})
  }, [])

  const updateEntry = useCallback((id: string, patch: Partial<CalendarEntry>) => {
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)))

    authFetch('/api/calendar', {
      method: 'PUT',
      body: JSON.stringify({ id, ...patch }),
    }).catch(() => {})
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))

    authFetch('/api/calendar', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }, [])

  return { entries, addEntry, updateEntry, deleteEntry }
}
