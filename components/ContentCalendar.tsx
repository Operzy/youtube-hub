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

const STATUS_COLORS: Record<CalendarStatus, string> = {
  idea: 'bg-gray-100 text-gray-700',
  scripting: 'bg-blue-100 text-blue-700',
  filming: 'bg-yellow-100 text-yellow-700',
  editing: 'bg-purple-100 text-purple-700',
  scheduled: 'bg-orange-100 text-orange-700',
  published: 'bg-green-100 text-green-700',
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

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  return (
    <div>
      {/* New entry form */}
      {showForm && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Add Content</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Title"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
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
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              rows={2}
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
          <h2 className="text-sm font-semibold text-gray-900">{monthName} {year}</h2>
          <button onClick={nextMonth} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 transition">
            <svg className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setFormDate(toDateStr(new Date())) }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition"
          >
            + Add Content
          </button>
        )}
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
      <div className="grid grid-cols-7 border-t border-l border-gray-200">
        {cells.map((day, i) => {
          const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
          const dayEntries = dateStr ? entries.filter(e => e.date === dateStr) : []
          const isToday = dateStr === toDateStr(today)

          return (
            <div
              key={i}
              className={`min-h-[80px] border-r border-b border-gray-200 p-1 ${
                day ? 'bg-white' : 'bg-gray-50'
              }`}
              onClick={() => day && setSelected(dateStr)}
            >
              {day && (
                <>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday ? 'bg-red-600 text-white font-bold' : 'text-gray-700'
                  }`}>
                    {day}
                  </span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEntries.slice(0, 2).map(e => (
                      <div
                        key={e.id}
                        className={`rounded px-1 py-0.5 text-[10px] font-medium truncate cursor-pointer ${STATUS_COLORS[e.status]}`}
                        onClick={ev => { ev.stopPropagation(); setSelected(dateStr) }}
                      >
                        {e.title}
                      </div>
                    ))}
                    {dayEntries.length > 2 && (
                      <span className="text-[10px] text-gray-400">+{dayEntries.length - 2} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selected && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">{selected}</h3>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
          {entries.filter(e => e.date === selected).length === 0 ? (
            <p className="text-xs text-gray-400">No entries for this day.</p>
          ) : (
            <div className="space-y-2">
              {entries.filter(e => e.date === selected).map(e => (
                <div key={e.id} className="flex items-start justify-between rounded-lg border border-gray-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{e.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        value={e.status}
                        onChange={ev => onUpdate(e.id, { status: ev.target.value as CalendarStatus })}
                        className="rounded border border-gray-200 px-2 py-0.5 text-xs"
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    {e.notes && <p className="text-xs text-gray-500 mt-1">{e.notes}</p>}
                  </div>
                  <button
                    onClick={() => onDelete(e.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
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
