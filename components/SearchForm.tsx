'use client'

import { useState } from 'react'
import { VideoResult } from '@/types/youtube'

interface Props {
  onResults: (results: VideoResult[], keyword: string) => void
  onError: (msg: string) => void
  onLoading: (loading: boolean) => void
  loading: boolean
}

const SORT_OPTIONS = [
  { value: 'views', label: 'Most Viewed' },
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Upload Date' },
  { value: 'rating', label: 'Rating' },
]

const DATE_OPTIONS = [
  { value: '', label: 'Any Time' },
  { value: 'hour', label: 'Last Hour' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

const CONTENT_TYPE_OPTIONS = [
  { value: 'videos', label: 'Videos' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'streams', label: 'Streams' },
  { value: 'all', label: 'All Types' },
]

const LENGTH_OPTIONS = [
  { value: '', label: 'Any Length' },
  { value: 'under4', label: 'Under 4 min' },
  { value: 'between420', label: '4-20 min' },
  { value: 'plus20', label: 'Over 20 min' },
]

export default function SearchForm({ onResults, onError, onLoading, loading }: Props) {
  const [query, setQuery] = useState('')
  const [maxResults, setMaxResults] = useState(20)
  const [sortBy, setSortBy] = useState('views')
  const [dateFilter, setDateFilter] = useState('month')
  const [contentType, setContentType] = useState('videos')
  const [lengthFilter, setLengthFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const kw = query.trim()
    if (!kw) return

    onError('')
    onLoading(true)

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: kw,
          maxResults,
          sortBy,
          dateFilter: dateFilter || undefined,
          contentType,
          lengthFilter: lengthFilter || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scrape failed')

      onResults(data.videos, data.keyword)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      onLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wide">
            Search YouTube
          </label>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. credit repair tips"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            disabled={loading}
          />
        </div>

        <div className="w-24">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wide">
            Max
          </label>
          <select
            value={maxResults}
            onChange={e => setMaxResults(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            disabled={loading}
          >
            {[10, 20, 30, 50].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(f => !f)}
          className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
            showFilters
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
          disabled={loading}
        >
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 4h18M7 9h10M10 14h4M11 19h2" strokeLinecap="round" />
            </svg>
            Filters
          </span>
        </button>

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="min-w-[130px]">
            <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              disabled={loading}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[130px]">
            <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Upload Date
            </label>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              disabled={loading}
            >
              {DATE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[130px]">
            <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Content Type
            </label>
            <select
              value={contentType}
              onChange={e => setContentType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              disabled={loading}
            >
              {CONTENT_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[130px]">
            <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Duration
            </label>
            <select
              value={lengthFilter}
              onChange={e => setLengthFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              disabled={loading}
            >
              {LENGTH_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </form>
  )
}
