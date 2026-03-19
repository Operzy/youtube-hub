'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { authFetch } from '@/lib/api-client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend, Area, AreaChart, ComposedChart,
} from 'recharts'

interface ChannelData {
  id: string
  title: string
  description: string
  customUrl: string
  thumbnailUrl: string
  publishedAt: string
  subscriberCount: number
  viewCount: number
  videoCount: number
  hiddenSubscriberCount: boolean
}

interface VideoData {
  id: string
  title: string
  publishedAt: string
  thumbnailUrl: string
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds: number
  videoType: 'short' | 'long'
}

interface YouTubeData {
  channel: ChannelData
  videos: VideoData[]
}

type TimeRange = 'all' | '1y' | '6m' | '3m' | '1m'
type ViewMode = 'overview' | 'weekly' | 'videos'

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}:${String(s).padStart(2, '0')}`
  const h = Math.floor(m / 60)
  return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function engagementRate(v: VideoData): number {
  if (v.viewCount === 0) return 0
  return ((v.likeCount + v.commentCount) / v.viewCount) * 100
}

// Get the Monday of the week for a given date
function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function filterByTimeRange(videos: VideoData[], range: TimeRange): VideoData[] {
  if (range === 'all') return videos
  const now = new Date()
  const cutoff = new Date(now)
  switch (range) {
    case '1y': cutoff.setFullYear(cutoff.getFullYear() - 1); break
    case '6m': cutoff.setMonth(cutoff.getMonth() - 6); break
    case '3m': cutoff.setMonth(cutoff.getMonth() - 3); break
    case '1m': cutoff.setMonth(cutoff.getMonth() - 1); break
  }
  const cutoffStr = cutoff.toISOString()
  return videos.filter(v => v.publishedAt >= cutoffStr)
}

export default function YouTubeAnalytics() {
  const [handle, setHandle] = useState('')
  const [inputHandle, setInputHandle] = useState('')
  const [data, setData] = useState<YouTubeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastFetched, setLastFetched] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('overview')
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [videoFilter, setVideoFilter] = useState<'all' | 'short' | 'long'>('all')
  const [videoSort, setVideoSort] = useState<'date' | 'views' | 'engagement'>('date')

  useEffect(() => {
    const saved = localStorage.getItem('yt-channel-handle')
    if (saved) {
      setHandle(saved)
      setInputHandle(saved)
    } else {
      // Default to @creditcoachq
      setHandle('creditcoachq')
      setInputHandle('creditcoachq')
    }
    const cachedData = localStorage.getItem('yt-channel-data')
    const cachedTime = localStorage.getItem('yt-channel-fetched')
    if (cachedData && cachedTime) {
      try {
        setData(JSON.parse(cachedData))
        setLastFetched(cachedTime)
      } catch {}
    }
  }, [])

  const fetchChannel = useCallback(async (channelHandle: string) => {
    if (!channelHandle.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await authFetch(`/api/youtube?handle=${encodeURIComponent(channelHandle.trim())}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch channel data')
      }
      const result = await res.json()
      setData(result)
      setHandle(channelHandle.trim())
      localStorage.setItem('yt-channel-handle', channelHandle.trim())
      localStorage.setItem('yt-channel-data', JSON.stringify(result))
      const now = new Date().toISOString()
      localStorage.setItem('yt-channel-fetched', now)
      setLastFetched(now)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (handle && !data && !loading) {
      fetchChannel(handle)
    }
  }, [handle, data, loading, fetchChannel])

  // Filtered videos by time range
  const filteredVideos = useMemo(() => {
    if (!data) return []
    return filterByTimeRange(data.videos, timeRange)
  }, [data, timeRange])

  const shorts = useMemo(() => filteredVideos.filter(v => v.videoType === 'short'), [filteredVideos])
  const longs = useMemo(() => filteredVideos.filter(v => v.videoType === 'long'), [filteredVideos])

  // Weekly breakdown data
  const weeklyData = useMemo(() => {
    if (filteredVideos.length === 0) return []

    const weekMap = new Map<string, { shorts: number; longs: number; totalViews: number; totalEngagement: number; videoCount: number }>()

    // Sort videos by date ascending
    const sorted = [...filteredVideos].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))

    sorted.forEach(v => {
      const week = getWeekStart(new Date(v.publishedAt))
      const existing = weekMap.get(week) || { shorts: 0, longs: 0, totalViews: 0, totalEngagement: 0, videoCount: 0 }
      if (v.videoType === 'short') existing.shorts++
      else existing.longs++
      existing.totalViews += v.viewCount
      existing.totalEngagement += engagementRate(v)
      existing.videoCount++
      weekMap.set(week, existing)
    })

    // Fill in empty weeks
    if (sorted.length > 0) {
      const firstDate = new Date(sorted[0].publishedAt)
      const lastDate = new Date()
      const current = new Date(getWeekStart(firstDate) + 'T00:00:00')
      const end = new Date(getWeekStart(lastDate) + 'T00:00:00')

      while (current <= end) {
        const weekStr = current.toISOString().split('T')[0]
        if (!weekMap.has(weekStr)) {
          weekMap.set(weekStr, { shorts: 0, longs: 0, totalViews: 0, totalEngagement: 0, videoCount: 0 })
        }
        current.setDate(current.getDate() + 7)
      }
    }

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week,
        weekLabel: getWeekLabel(week),
        shorts: data.shorts,
        longs: data.longs,
        total: data.shorts + data.longs,
        avgViews: data.videoCount > 0 ? Math.round(data.totalViews / data.videoCount) : 0,
        totalViews: data.totalViews,
        avgEngagement: data.videoCount > 0 ? parseFloat((data.totalEngagement / data.videoCount).toFixed(2)) : 0,
      }))
  }, [filteredVideos])

  // Stats
  const stats = useMemo(() => {
    const totalViews = filteredVideos.reduce((s, v) => s + v.viewCount, 0)
    const totalLikes = filteredVideos.reduce((s, v) => s + v.likeCount, 0)
    const totalComments = filteredVideos.reduce((s, v) => s + v.commentCount, 0)
    const avgViews = filteredVideos.length > 0 ? Math.round(totalViews / filteredVideos.length) : 0
    const avgEngagement = filteredVideos.length > 0
      ? (filteredVideos.reduce((s, v) => s + engagementRate(v), 0) / filteredVideos.length).toFixed(1)
      : '0'

    const shortsAvgViews = shorts.length > 0 ? Math.round(shorts.reduce((s, v) => s + v.viewCount, 0) / shorts.length) : 0
    const longsAvgViews = longs.length > 0 ? Math.round(longs.reduce((s, v) => s + v.viewCount, 0) / longs.length) : 0

    const weeksWithUploads = weeklyData.filter(w => w.total > 0).length
    const totalWeeks = weeklyData.length || 1
    const uploadConsistency = Math.round((weeksWithUploads / totalWeeks) * 100)

    const avgShortsPerWeek = totalWeeks > 0 ? (shorts.length / totalWeeks).toFixed(1) : '0'
    const avgLongsPerWeek = totalWeeks > 0 ? (longs.length / totalWeeks).toFixed(1) : '0'

    const bestVideo = filteredVideos.length > 0
      ? filteredVideos.reduce((best, v) => v.viewCount > best.viewCount ? v : best, filteredVideos[0])
      : null

    return {
      totalVideos: filteredVideos.length,
      totalShorts: shorts.length,
      totalLongs: longs.length,
      totalViews,
      totalLikes,
      totalComments,
      avgViews,
      avgEngagement,
      shortsAvgViews,
      longsAvgViews,
      uploadConsistency,
      avgShortsPerWeek,
      avgLongsPerWeek,
      bestVideo,
      weeksWithUploads,
      totalWeeks,
    }
  }, [filteredVideos, shorts, longs, weeklyData])

  // Videos list with filtering and sorting
  const displayVideos = useMemo(() => {
    let vids = [...filteredVideos]
    if (videoFilter === 'short') vids = vids.filter(v => v.videoType === 'short')
    if (videoFilter === 'long') vids = vids.filter(v => v.videoType === 'long')

    switch (videoSort) {
      case 'date': vids.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)); break
      case 'views': vids.sort((a, b) => b.viewCount - a.viewCount); break
      case 'engagement': vids.sort((a, b) => engagementRate(b) - engagementRate(a)); break
    }
    return vids
  }, [filteredVideos, videoFilter, videoSort])

  function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    fetchChannel(inputHandle)
  }

  function handleDisconnect() {
    setData(null)
    setHandle('')
    setInputHandle('')
    localStorage.removeItem('yt-channel-handle')
    localStorage.removeItem('yt-channel-data')
    localStorage.removeItem('yt-channel-fetched')
  }

  // Not connected
  if (!handle && !data) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-6">
        <div className="text-center mb-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-3">
            <svg className="h-6 w-6 text-red-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Connect Your YouTube Channel</h3>
          <p className="text-xs text-gray-500 mt-1">Enter your channel handle to see full analytics</p>
        </div>
        <form onSubmit={handleConnect} className="flex gap-2 max-w-md mx-auto">
          <input
            type="text"
            value={inputHandle}
            onChange={e => setInputHandle(e.target.value)}
            placeholder="@YourChannel"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <button
            type="submit"
            disabled={loading || !inputHandle.trim()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </form>
        {error && <p className="text-xs text-red-500 text-center mt-2">{error}</p>}
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent mx-auto" />
        <p className="text-sm text-gray-500 mt-3">Fetching your full YouTube history...</p>
        <p className="text-xs text-gray-400 mt-1">This may take a moment for channels with many videos</p>
      </div>
    )
  }

  if (!data) return null

  const { channel } = data

  return (
    <div className="space-y-4">
      {/* Channel Header */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-gray-900 to-gray-800 p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {channel.thumbnailUrl && (
              <img src={channel.thumbnailUrl} alt={channel.title} className="h-14 w-14 rounded-full border-2 border-white/20" />
            )}
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                {channel.title}
                <span className="text-xs font-normal text-gray-400">{channel.customUrl}</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {data.videos.length} videos tracked &middot; Joined {new Date(channel.publishedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchChannel(handle)} disabled={loading}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 transition disabled:opacity-50">
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button onClick={handleDisconnect}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-red-500/30 transition">
              Disconnect
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="rounded-lg bg-white/10 p-3 text-center">
            <p className="text-xl font-bold">{formatNumber(channel.subscriberCount)}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Subscribers</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3 text-center">
            <p className="text-xl font-bold">{formatNumber(channel.viewCount)}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Total Views</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3 text-center">
            <p className="text-xl font-bold">{channel.videoCount}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Videos</p>
          </div>
        </div>

        {lastFetched && (
          <p className="text-[10px] text-gray-500 mt-3 text-right">Last updated: {new Date(lastFetched).toLocaleString()}</p>
        )}
      </div>

      {/* Controls: Time Range + View Mode */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-gray-200 p-0.5">
          {(['1m', '3m', '6m', '1y', 'all'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                timeRange === range ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 p-0.5">
          {([['overview', 'Overview'], ['weekly', 'Weekly'], ['videos', 'Videos']] as [ViewMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                viewMode === mode ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Shorts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalShorts}</p>
          <p className="text-[10px] text-gray-400">{stats.avgShortsPerWeek}/week avg &middot; {formatNumber(stats.shortsAvgViews)} avg views</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50 to-white p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Long-Form</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalLongs}</p>
          <p className="text-[10px] text-gray-400">{stats.avgLongsPerWeek}/week avg &middot; {formatNumber(stats.longsAvgViews)} avg views</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-white p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Avg Engagement</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.avgEngagement}%</p>
          <p className="text-[10px] text-gray-400">(likes + comments) / views</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-orange-50 to-white p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Consistency</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.uploadConsistency}%</p>
          <p className="text-[10px] text-gray-400">{stats.weeksWithUploads}/{stats.totalWeeks} weeks had uploads</p>
        </div>
      </div>

      {/* ============ OVERVIEW MODE ============ */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Shorts vs Longs Posting */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Shorts vs Long-Form (Weekly)</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData.slice(-26)} barCategoryGap="10%">
                <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(weeklyData.slice(-26).length / 8))} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="shorts" name="Shorts" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="longs" name="Long-Form" fill="#a855f7" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Views Over Time */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Avg Views Per Week</h4>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyData.slice(-26)}>
                <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(weeklyData.slice(-26).length / 8))} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(v)} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(value) => [formatNumber(Number(value)), 'Avg Views']} />
                <Area type="monotone" dataKey="avgViews" stroke="#dc2626" fill="#dc262620" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Engagement Trend */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Engagement Rate Trend</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyData.slice(-26)}>
                <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(weeklyData.slice(-26).length / 8))} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(value) => [Number(value).toFixed(2) + '%', 'Engagement']} />
                <Line type="monotone" dataKey="avgEngagement" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Shorts vs Longs Performance Comparison */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Shorts vs Long-Form Performance</h4>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Avg Views</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-blue-600 font-medium">Shorts</span>
                      <span className="text-[10px] font-bold text-gray-900">{formatNumber(stats.shortsAvgViews)}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, stats.shortsAvgViews / Math.max(stats.shortsAvgViews, stats.longsAvgViews, 1) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-purple-600 font-medium">Long-Form</span>
                      <span className="text-[10px] font-bold text-gray-900">{formatNumber(stats.longsAvgViews)}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${Math.min(100, stats.longsAvgViews / Math.max(stats.shortsAvgViews, stats.longsAvgViews, 1) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Avg Engagement</span>
                </div>
                <div className="flex gap-2">
                  {[
                    { label: 'Shorts', vids: shorts, color: 'blue' },
                    { label: 'Long-Form', vids: longs, color: 'purple' },
                  ].map(({ label, vids, color }) => {
                    const avgEng = vids.length > 0
                      ? (vids.reduce((s, v) => s + engagementRate(v), 0) / vids.length).toFixed(1)
                      : '0'
                    return (
                      <div key={label} className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[10px] text-${color}-600 font-medium`}>{label}</span>
                          <span className="text-[10px] font-bold text-gray-900">{avgEng}%</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full bg-${color}-500 rounded-full transition-all`} style={{ width: `${Math.min(100, parseFloat(avgEng) * 10)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{stats.totalShorts}</p>
                  <p className="text-[10px] text-gray-400">Total Shorts</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-purple-600">{stats.totalLongs}</p>
                  <p className="text-[10px] text-gray-400">Total Long-Form</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ WEEKLY MODE ============ */}
      {viewMode === 'weekly' && (
        <div className="space-y-4">
          {/* Full Weekly Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Weekly Posting Schedule</h4>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={weeklyData}>
                <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(weeklyData.length / 12))} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(v)} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="shorts" name="Shorts" fill="#3b82f6" stackId="a" />
                <Bar yAxisId="left" dataKey="longs" name="Long-Form" fill="#a855f7" stackId="a" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="totalViews" name="Total Views" stroke="#dc2626" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Weekly Table */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900">Week-by-Week Breakdown</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Week Of</th>
                    <th className="text-center px-3 py-2 font-medium text-blue-500">Shorts</th>
                    <th className="text-center px-3 py-2 font-medium text-purple-500">Long-Form</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500">Total</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500">Views</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {[...weeklyData].reverse().slice(0, 52).map(w => (
                    <tr key={w.week} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-2 text-gray-700 font-medium">{w.week}</td>
                      <td className="text-center px-3 py-2">
                        {w.shorts > 0 ? (
                          <span className="inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 font-bold">{w.shorts}</span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="text-center px-3 py-2">
                        {w.longs > 0 ? (
                          <span className="inline-flex items-center justify-center rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 font-bold">{w.longs}</span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="text-center px-3 py-2 font-bold text-gray-700">{w.total || <span className="text-gray-300">-</span>}</td>
                      <td className="text-right px-4 py-2 text-gray-600">{w.totalViews > 0 ? formatNumber(w.totalViews) : '-'}</td>
                      <td className="text-right px-4 py-2">
                        {w.avgEngagement > 0 ? (
                          <span className={`font-medium ${w.avgEngagement >= 5 ? 'text-green-600' : w.avgEngagement >= 2 ? 'text-orange-500' : 'text-gray-400'}`}>
                            {w.avgEngagement}%
                          </span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ VIDEOS MODE ============ */}
      {viewMode === 'videos' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 p-0.5">
              {([['all', 'All'], ['short', 'Shorts'], ['long', 'Long-Form']] as ['all' | 'short' | 'long', string][]).map(([f, label]) => (
                <button key={f} onClick={() => setVideoFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${videoFilter === f ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  {label} {f === 'all' ? `(${filteredVideos.length})` : f === 'short' ? `(${shorts.length})` : `(${longs.length})`}
                </button>
              ))}
            </div>
            <select
              value={videoSort}
              onChange={e => setVideoSort(e.target.value as typeof videoSort)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-red-500 focus:outline-none"
            >
              <option value="date">Sort by Date</option>
              <option value="views">Sort by Views</option>
              <option value="engagement">Sort by Engagement</option>
            </select>
            <span className="text-[11px] text-gray-400">{displayVideos.length} videos</span>
          </div>

          {/* Video Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayVideos.slice(0, 60).map(v => {
              const er = engagementRate(v)
              const isExpanded = selectedVideo === v.id

              return (
                <div
                  key={v.id}
                  className={`rounded-lg border p-3 cursor-pointer transition-all ${
                    isExpanded ? 'border-red-300 bg-red-50' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                  }`}
                  onClick={() => setSelectedVideo(isExpanded ? null : v.id)}
                >
                  <div className="flex gap-3">
                    <div className="relative flex-shrink-0">
                      <img src={v.thumbnailUrl} alt={v.title} className="h-16 w-28 rounded object-cover" />
                      <span className={`absolute bottom-0.5 right-0.5 rounded px-1 py-0.5 text-[8px] font-bold text-white ${
                        v.videoType === 'short' ? 'bg-blue-600' : 'bg-purple-600'
                      }`}>
                        {v.videoType === 'short' ? 'SHORT' : formatDuration(v.durationSeconds)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 line-clamp-2">{v.title}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(v.publishedAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                      <span className="text-[10px] font-medium text-gray-600">{formatNumber(v.viewCount)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
                      <span className="text-[10px] font-medium text-gray-600">{formatNumber(v.likeCount)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>
                      <span className="text-[10px] font-medium text-gray-600">{formatNumber(v.commentCount)}</span>
                    </div>
                    <span className={`ml-auto text-[10px] font-bold ${er >= 5 ? 'text-green-600' : er >= 2 ? 'text-orange-500' : 'text-gray-400'}`}>
                      {er.toFixed(1)}%
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                      <div className="text-[10px] text-gray-400">
                        {new Date(v.publishedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        &middot; {formatDuration(v.durationSeconds)}
                      </div>
                      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-red-500 hover:text-red-700 font-medium">
                        Watch ↗
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {displayVideos.length > 60 && (
            <p className="text-xs text-gray-400 text-center">Showing first 60 of {displayVideos.length} videos</p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  )
}
