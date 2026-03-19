'use client'

import { useState, useEffect } from 'react'
import { CalendarEntry, CalendarStatus, SavedVideo } from '@/types/youtube'

interface Props {
  entries: CalendarEntry[]
  onAdd: (entry: Omit<CalendarEntry, 'id'>) => void
  onUpdate: (id: string, patch: Partial<CalendarEntry>) => void
  onDelete: (id: string) => void
  pendingVideo?: SavedVideo | null
  onPendingConsumed?: () => void
}

const STATUSES: CalendarStatus[] = ['idea', 'scripting', 'filming', 'editing', 'scheduled', 'published']

const STATUS_META: Record<CalendarStatus, { label: string; bg: string; text: string; dot: string; emoji: string }> = {
  idea: { label: 'Idea', bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400', emoji: '💡' },
  scripting: { label: 'Scripting', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', emoji: '✍️' },
  filming: { label: 'Filming', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500', emoji: '🎬' },
  editing: { label: 'Editing', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', emoji: '🎞️' },
  scheduled: { label: 'Scheduled', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', emoji: '📅' },
  published: { label: 'Published', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', emoji: '🚀' },
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function ContentCalendar({ entries, onAdd, onUpdate, onDelete, pendingVideo, onPendingConsumed }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formStatus, setFormStatus] = useState<CalendarStatus>('idea')
  const [formNotes, setFormNotes] = useState('')
  const [formSourceUrl, setFormSourceUrl] = useState('')
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null)
  const [quickAddTitle, setQuickAddTitle] = useState('')

  useEffect(() => {
    if (pendingVideo) {
      setFormTitle(pendingVideo.title ?? '')
      setFormSourceUrl(pendingVideo.url ?? '')
      setFormDate(toDateStr(new Date()))
      setFormStatus('idea')
      setFormNotes('')
      setShowForm(true)
      onPendingConsumed?.()
    }
  }, [pendingVideo, onPendingConsumed])

  const firstDay = new Date(year, month, 1).getDay()
  const totalDays = daysInMonth(year, month)
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  function goToToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim() || !formDate) return
    onAdd({
      title: formTitle.trim(),
      date: formDate,
      status: formStatus,
      notes: formNotes,
      sourceUrl: formSourceUrl || undefined,
    })
    setShowForm(false)
    setFormTitle('')
    setFormDate('')
    setFormNotes('')
    setFormSourceUrl('')
  }

  function handleQuickAdd(dateStr: string) {
    if (!quickAddTitle.trim()) return
    onAdd({
      title: quickAddTitle.trim(),
      date: dateStr,
      status: 'idea',
      notes: '',
    })
    setQuickAddTitle('')
    setQuickAddDate(null)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  // Count entries by status for this month
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`
  const monthEntries = entries.filter(e => e.date >= monthStart && e.date <= monthEnd)

  return (
    <div>
      {/* Month stats bar */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map(s => {
          const count = monthEntries.filter(e => e.status === s).length
          if (count === 0) return null
          return (
            <span key={s} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_META[s].bg} ${STATUS_META[s].text}`}>
              <span>{STATUS_META[s].emoji}</span>
              {STATUS_META[s].label}: {count}
            </span>
          )
        })}
        {monthEntries.length === 0 && (
          <span className="text-[11px] text-gray-400">No content scheduled this month</span>
        )}
      </div>

      {/* New entry form */}
      {showForm && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            ✨ Add Content
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Video title..."
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              autoFocus
            />
            <div className="flex gap-3">
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              />
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as CalendarStatus)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none resize-none"
            />
            <input
              type="url"
              placeholder="Source URL (optional)"
              value={formSourceUrl}
              onChange={e => setFormSourceUrl(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition">
                Add
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calendar header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <svg className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <h2 className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">{monthName} {year}</h2>
          <button onClick={nextMonth} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <svg className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <button
            onClick={goToToday}
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:text-red-600 hover:border-red-200 transition"
          >
            Today
          </button>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setFormDate(toDateStr(new Date())) }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition flex items-center gap-1.5"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Add Content
          </button>
        )}
      </div>

      {/* Status legend */}
      <div className="mb-3 flex flex-wrap gap-3">
        {STATUSES.map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${STATUS_META[s].dot}`} />
            <span className="text-[10px] text-gray-500">{STATUS_META[s].label}</span>
          </div>
        ))}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-medium text-gray-400 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-t border-l border-gray-200 rounded-lg overflow-hidden">
        {cells.map((day, i) => {
          const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
          const dayEntries = dateStr ? entries.filter(e => e.date === dateStr) : []
          const isToday = dateStr === toDateStr(today)
          const isPast = dateStr ? dateStr < toDateStr(today) : false
          const isSelected = dateStr === selected
          const isQuickAdding = dateStr === quickAddDate

          return (
            <div
              key={i}
              className={`min-h-[90px] border-r border-b border-gray-200 p-1.5 transition-colors cursor-pointer ${
                day
                  ? isSelected
                    ? 'bg-red-50'
                    : isToday
                      ? 'bg-yellow-50'
                      : isPast
                        ? 'bg-gray-50'
                        : 'bg-white hover:bg-gray-50'
                  : 'bg-gray-50'
              }`}
              onClick={() => {
                if (day) {
                  setSelected(isSelected ? null : dateStr)
                  setQuickAddDate(null)
                }
              }}
              onDoubleClick={() => {
                if (day && dateStr) {
                  setQuickAddDate(dateStr)
                  setQuickAddTitle('')
                }
              }}
            >
              {day && (
                <>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday ? 'bg-red-600 text-white font-bold' : isPast ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      {day}
                    </span>
                    {dayEntries.length > 0 && (
                      <span className="flex -space-x-0.5">
                        {dayEntries.slice(0, 3).map(e => (
                          <span
                            key={e.id}
                            className={`inline-block h-2 w-2 rounded-full ${STATUS_META[e.status].dot} ring-1 ring-white`}
                          />
                        ))}
                      </span>
                    )}
                  </div>

                  {/* Quick add inline */}
                  {isQuickAdding && (
                    <div className="mt-1" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={quickAddTitle}
                        onChange={e => setQuickAddTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && dateStr) handleQuickAdd(dateStr)
                          if (e.key === 'Escape') setQuickAddDate(null)
                        }}
                        placeholder="Video title..."
                        className="w-full rounded border border-red-300 px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-red-500"
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="space-y-0.5 mt-0.5">
                    {dayEntries.slice(0, 2).map(e => (
                      <div
                        key={e.id}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition ${STATUS_META[e.status].bg} ${STATUS_META[e.status].text}`}
                        onClick={ev => { ev.stopPropagation(); setSelected(dateStr) }}
                      >
                        {STATUS_META[e.status].emoji} {e.title}
                      </div>
                    ))}
                    {dayEntries.length > 2 && (
                      <span className="text-[10px] text-gray-400 font-medium">+{dayEntries.length - 2} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Double-click hint */}
      <p className="text-[10px] text-gray-400 mt-2 text-center">
        Double-click any date to quickly add content
      </p>

      {/* Selected day detail */}
      {selected && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              📋 {new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowForm(true); setFormDate(selected) }}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                + Add here
              </button>
              <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600">
                Close
              </button>
            </div>
          </div>
          {entries.filter(e => e.date === selected).length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-2">No content scheduled</p>
              <button
                onClick={() => { setShowForm(true); setFormDate(selected) }}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Schedule something for this day
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.filter(e => e.date === selected).map(e => (
                <div key={e.id} className="flex items-start justify-between rounded-lg border border-gray-100 p-3 hover:border-gray-200 transition">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{STATUS_META[e.status].emoji}</span>
                      <p className="text-sm font-medium text-gray-900">{e.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <select
                        value={e.status}
                        onChange={ev => onUpdate(e.id, { status: ev.target.value as CalendarStatus })}
                        className="rounded border border-gray-200 px-2 py-0.5 text-xs focus:border-red-500 focus:outline-none"
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
                        ))}
                      </select>
                      {e.sourceUrl && (
                        <a
                          href={e.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                        >
                          Source ↗
                        </a>
                      )}
                    </div>
                    {e.notes && <p className="text-xs text-gray-500 mt-1.5">{e.notes}</p>}
                  </div>
                  <button
                    onClick={() => onDelete(e.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition ml-2"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
