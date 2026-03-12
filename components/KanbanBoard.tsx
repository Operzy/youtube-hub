'use client'

import { useState } from 'react'
import { CalendarEntry, CalendarStatus } from '@/types/youtube'

interface Props {
  entries: CalendarEntry[]
  onAdd: (entry: Omit<CalendarEntry, 'id'>) => void
  onUpdate: (id: string, patch: Partial<CalendarEntry>) => void
  onDelete: (id: string) => void
}

const COLUMNS: { status: CalendarStatus; label: string; color: string }[] = [
  { status: 'idea', label: 'Ideas', color: 'border-t-gray-400' },
  { status: 'scripting', label: 'Scripting', color: 'border-t-blue-500' },
  { status: 'filming', label: 'Filming', color: 'border-t-yellow-500' },
  { status: 'editing', label: 'Editing', color: 'border-t-purple-500' },
  { status: 'scheduled', label: 'Scheduled', color: 'border-t-orange-500' },
  { status: 'published', label: 'Published', color: 'border-t-green-500' },
]

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function KanbanBoard({ entries, onAdd, onUpdate, onDelete }: Props) {
  const [addingTo, setAddingTo] = useState<CalendarStatus | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)

  function handleAdd(status: CalendarStatus) {
    if (!newTitle.trim()) return
    onAdd({ title: newTitle.trim(), date: toDateStr(new Date()), status, notes: '' })
    setNewTitle('')
    setAddingTo(null)
  }

  function handleDrop(targetStatus: CalendarStatus) {
    if (dragId) {
      onUpdate(dragId, { status: targetStatus })
      setDragId(null)
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const colEntries = entries.filter(e => e.status === col.status)

        return (
          <div
            key={col.status}
            className={`flex-shrink-0 w-56 rounded-xl border border-gray-200 border-t-2 ${col.color} bg-gray-50`}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col.status)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between p-3 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{col.label}</h3>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-500 border border-gray-200">
                  {colEntries.length}
                </span>
              </div>
              <button
                onClick={() => { setAddingTo(col.status); setNewTitle('') }}
                className="text-gray-400 hover:text-red-500 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>

            {/* Add form */}
            {addingTo === col.status && (
              <div className="mx-3 mb-2 rounded-lg bg-white border border-gray-200 p-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(col.status); if (e.key === 'Escape') setAddingTo(null) }}
                  placeholder="Content title…"
                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-red-500 focus:outline-none"
                  autoFocus
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    onClick={() => handleAdd(col.status)}
                    className="rounded bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddingTo(null)}
                    className="rounded border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Cards */}
            <div className="space-y-2 p-3 pt-1">
              {colEntries.map(entry => (
                <div
                  key={entry.id}
                  draggable
                  onDragStart={() => setDragId(entry.id)}
                  className="rounded-lg bg-white border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
                >
                  <p className="text-xs font-medium text-gray-900 line-clamp-2">{entry.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-gray-400">{entry.date}</span>
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="text-[10px] text-gray-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                  {entry.notes && (
                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{entry.notes}</p>
                  )}
                </div>
              ))}

              {colEntries.length === 0 && addingTo !== col.status && (
                <p className="text-center text-[10px] text-gray-400 py-4">No items</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
