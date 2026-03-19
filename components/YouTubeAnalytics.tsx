'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/api-client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
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
}

interface YouTubeData {
  channel: ChannelData
  recentVideos: VideoData[]
}

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
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

function engagementRate(v: VideoData): number {
  if (v.viewCount === 0) return 0
  return ((v.likeCount + v.commentCount) / v.viewCount) * 100
}

export default function YouTubeAnalytics() {
  const [handle, setHandle] = useState('')
  const [inputHandle, setInputHandle] = useState('')
  const [data, setData] = useState<YouTubeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastFetched, setLastFetched] = useState<string | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)

  // Load saved handle on mount
  useEffect(() => {
    const saved = localStorage.getItem('yt-channel-handle')
    if (saved) {
      setHandle(saved)
      setInputHandle(saved)
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

  // Auto-fetch if we have a saved handle but no data
  useEffect(() => {
    if (handle && !data && !loading) {
      fetchChannel(handle)
    }
  }, [handle, data, loading, fetchChannel])

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

  // Not connected yet
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
          <p className="text-xs text-gray-500 mt-1">Enter your channel handle to see live analytics</p>
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

  // Loading state
  if (loading && !data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent mx-auto" />
        <p className="text-sm text-gray-500 mt-3">Fetching your YouTube data...</p>
      </div>
    )
  }

  if (!data) return null

  const { channel, recentVideos } = data

  // Video performance chart data
  const chartData = [...recentVideos]
    .reverse()
    .map(v => ({
      title: v.title.length > 20 ? v.title.slice(0, 20) + '...' : v.title,
      fullTitle: v.title,
      views: v.viewCount,
      likes: v.likeCount,
      comments: v.commentCount,
      engagement: parseFloat(engagementRate(v).toFixed(2)),
    }))

  const avgViews = recentVideos.length > 0
    ? Math.round(recentVideos.reduce((s, v) => s + v.viewCount, 0) / recentVideos.length)
    : 0

  const avgEngagement = recentVideos.length > 0
    ? (recentVideos.reduce((s, v) => s + engagementRate(v), 0) / recentVideos.length).toFixed(1)
    : '0'

  const bestVideo = recentVideos.length > 0
    ? recentVideos.reduce((best, v) => v.viewCount > best.viewCount ? v : best, recentVideos[0])
    : null

  return (
    <div className="space-y-4">
      {/* Channel Header */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-gray-900 to-gray-800 p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {channel.thumbnailUrl && (
              <img
                src={channel.thumbnailUrl}
                alt={channel.title}
                className="h-14 w-14 rounded-full border-2 border-white/20"
              />
            )}
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                {channel.title}
                <span className="text-xs font-normal text-gray-400">{channel.customUrl}</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Joined {new Date(channel.publishedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchChannel(handle)}
              disabled={loading}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 transition disabled:opacity-50"
            >
              {loading ? '...' : 'Refresh'}
            </button>
            <button
              onClick={handleDisconnect}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-red-500/30 transition"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* Channel Stats */}
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
          <p className="text-[10px] text-gray-500 mt-3 text-right">
            Last updated: {new Date(lastFetched).toLocaleString()}
          </p>
        )}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Avg Views</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatNumber(avgViews)}</p>
          <p className="text-[10px] text-gray-400">per video (last {recentVideos.length})</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Avg Engagement</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{avgEngagement}%</p>
          <p className="text-[10px] text-gray-400">(likes + comments) / views</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Best Performer</p>
          <p className="text-sm font-bold text-gray-900 mt-1 line-clamp-1">{bestVideo?.title || '-'}</p>
          <p className="text-[10px] text-gray-400">{bestVideo ? formatNumber(bestVideo.viewCount) + ' views' : ''}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Latest Upload</p>
          <p className="text-sm font-bold text-gray-900 mt-1 line-clamp-1">{recentVideos[0]?.title || '-'}</p>
          <p className="text-[10px] text-gray-400">{recentVideos[0] ? timeAgo(recentVideos[0].publishedAt) : ''}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Views per Video */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Views Per Video (Recent {recentVideos.length})</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barCategoryGap="15%">
              <XAxis dataKey="title" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(v)} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTitle || ''}
                formatter={(value) => [formatNumber(Number(value)), 'Views']}
              />
              <Bar dataKey="views" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.views >= avgViews ? '#22c55e' : '#dc2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-green-500" />
              <span className="text-[10px] text-gray-400">Above avg</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-red-600" />
              <span className="text-[10px] text-gray-400">Below avg</span>
            </div>
          </div>
        </div>

        {/* Engagement Trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Engagement Rate Trend</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="title" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTitle || ''}
                formatter={(value) => [Number(value).toFixed(2) + '%', 'Engagement']}
              />
              <Line type="monotone" dataKey="engagement" stroke="#dc2626" strokeWidth={2} dot={{ fill: '#dc2626', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Videos Grid */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Recent Uploads</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentVideos.map(v => {
            const isExpanded = selectedVideo === v.id
            const er = engagementRate(v)

            return (
              <div
                key={v.id}
                className={`rounded-lg border p-3 cursor-pointer transition-all ${
                  isExpanded ? 'border-red-300 bg-red-50' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                }`}
                onClick={() => setSelectedVideo(isExpanded ? null : v.id)}
              >
                <div className="flex gap-3">
                  <img
                    src={v.thumbnailUrl}
                    alt={v.title}
                    className="h-16 w-28 rounded object-cover flex-shrink-0"
                  />
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
                    {er.toFixed(1)}% eng
                  </span>
                </div>

                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <a
                      href={`https://www.youtube.com/watch?v=${v.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                      onClick={e => e.stopPropagation()}
                    >
                      Watch on YouTube ↗
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
