'use client'

import { useState } from 'react'
import { CalendarEntry, CalendarStatus } from '@/types/youtube'

interface Props {
  entries: CalendarEntry[]
  onAdd: (entry: Omit<CalendarEntry, 'id'>) => void
  onUpdate: (id: string, patch: Partial<CalendarEntry>) => void
  onDelete: (id: string) => void
}

const COLUMNS: { status: CalendarStatus; label: string; color: string; bgColor: string; emoji: string }[] = [
  { status: 'idea', label: 'Ideas', color: 'border-t-gray-400', bgColor: 'bg-gray-400', emoji: '💡' },
  { status: 'scripting', label: 'Scripting', color: 'border-t-blue-500', bgColor: 'bg-blue-500', emoji: '✍️' },
  { status: 'filming', label: 'Filming', color: 'border-t-yellow-500', bgColor: 'bg-yellow-500', emoji: '🎬' },
  { status: 'editing', label: 'Editing', color: 'border-t-purple-500', bgColor: 'bg-purple-500', emoji: '🎞️' },
  { status: 'scheduled', label: 'Scheduled', color: 'border-t-orange-500', bgColor: 'bg-orange-500', emoji: '📅' },
  { status: 'published', label: 'Published', color: 'border-t-green-500', bgColor: 'bg-green-500', emoji: '🚀' },
]

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function daysAgo(dateStr: string): number {
  const diff = new Date().getTime() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getDaysLabel(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

function getDaysColor(days: number, status: CalendarStatus): string {
  if (status === 'published' || status === 'idea') return 'text-gray-400'
  if (days > 14) return 'text-red-500'
  if (days > 7) return 'text-orange-500'
  return 'text-gray-400'
}

export default function KanbanBoard({ entries, onAdd, onUpdate, onDelete }: Props) {
  const [addingTo, setAddingTo] = useState<CalendarStatus | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<CalendarStatus | null>(null)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  function handleAdd(status: CalendarStatus) {
    if (!newTitle.trim()) return
    onAdd({ title: newTitle.trim(), date: toDateStr(new Date()), status, notes: newNotes.trim() })
    setNewTitle('')
    setNewNotes('')
    setAddingTo(null)
  }

  function handleDrop(targetStatus: CalendarStatus) {
    if (dragId) {
      onUpdate(dragId, { status: targetStatus })
      setDragId(null)
    }
    setDragOverCol(null)
  }

  function handleDragOver(e: React.DragEvent, status: CalendarStatus) {
    e.preventDefault()
    setDragOverCol(status)
  }

  function handleDragLeave() {
    setDragOverCol(null)
  }

  const totalEntries = entries.length

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const colEntries = entries.filter(e => e.status === col.status)
        const isDropTarget = dragOverCol === col.status && dragId !== null
        const progressPercent = totalEntries > 0 ? (colEntries.length / totalEntries) * 100 : 0

        return (
          <div
            key={col.status}
            className={`flex-shrink-0 w-60 rounded-xl border-2 border-t-[3px] ${col.color} transition-all duration-200 ${
              isDropTarget
                ? 'border-red-400 bg-red-50 scale-[1.02] shadow-lg'
                : 'border-gray-200 bg-gray-50'
            }`}
            onDragOver={e => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(col.status)}
          >
            {/* Column header */}
            <div className="p-3 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{col.emoji}</span>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{col.label}</h3>
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-500 border border-gray-200">
                    {colEntries.length}
                  </span>
                </div>
                <button
                  onClick={() => { setAddingTo(col.status); setNewTitle(''); setNewNotes('') }}
                  className="text-gray-400 hover:text-red-500 transition"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${col.bgColor}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Add form */}
            {addingTo === col.status && (
              <div className="mx-3 mb-2 rounded-lg bg-white border border-gray-200 p-2.5 shadow-sm">
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(col.status); if (e.key === 'Escape') setAddingTo(null) }}
                  placeholder="Video title..."
                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-red-500 focus:outline-none"
                  autoFocus
                />
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  rows={2}
                  className="w-full mt-1.5 rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-red-500 focus:outline-none resize-none"
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
            <div className="space-y-2 p-3 pt-1 min-h-[60px]">
              {colEntries.map(entry => {
                const days = daysAgo(entry.date)
                const isExpanded = expandedCard === entry.id
                const isDragging = dragId === entry.id

                return (
                  <div
                    key={entry.id}
                    draggable
                    onDragStart={() => setDragId(entry.id)}
                    onDragEnd={() => { setDragId(null); setDragOverCol(null) }}
                    onClick={() => setExpandedCard(isExpanded ? null : entry.id)}
                    className={`rounded-lg bg-white border p-3 cursor-grab active:cursor-grabbing transition-all duration-200 ${
                      isDragging
                        ? 'opacity-40 scale-95 border-red-300'
                        : 'border-gray-200 hover:shadow-md hover:border-gray-300'
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-900 line-clamp-2">{entry.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] font-medium ${getDaysColor(days, col.status)}`}>
                        {getDaysLabel(days)}
                      </span>
                      {days > 7 && !['published', 'idea'].includes(col.status) && (
                        <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-medium">
                          Stale
                        </span>
                      )}
                    </div>

                    {/* Expanded card details */}
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-2" onClick={e => e.stopPropagation()}>
                        {entry.notes && (
                          <p className="text-[11px] text-gray-500">{entry.notes}</p>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-gray-400">Move to:</span>
                          {COLUMNS.filter(c => c.status !== col.status).map(c => (
                            <button
                              key={c.status}
                              onClick={() => onUpdate(entry.id, { status: c.status })}
                              className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 hover:bg-red-50 hover:text-red-600 transition"
                              title={c.label}
                            >
                              {c.emoji}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          {entry.sourceUrl && (
                            <a
                              href={entry.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                            >
                              Source ↗
                            </a>
                          )}
                          <button
                            onClick={() => onDelete(entry.id)}
                            className="text-[10px] text-gray-400 hover:text-red-500 ml-auto"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {colEntries.length === 0 && addingTo !== col.status && (
                <div
                  className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-red-300 hover:bg-red-50 transition"
                  onClick={() => { setAddingTo(col.status); setNewTitle(''); setNewNotes('') }}
                >
                  <p className="text-[11px] text-gray-400">
                    {col.status === 'idea' ? 'Add your first idea!' : 'Drop items here'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
