'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { CalendarEntry, CalendarStatus, ContentProject, PostingGoals } from '@/types/youtube'
import { authFetch } from '@/lib/api-client'

interface YouTubeVideoData {
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

interface YouTubeChannelData {
  id: string
  title: string
  customUrl: string
  thumbnailUrl: string
  subscriberCount: number
  viewCount: number
  videoCount: number
}

interface Props {
  entries: CalendarEntry[]
  projects: ContentProject[]
  onGoToCalendar: () => void
  onGoToCreatorHub: () => void
  onGoToSearch: () => void
  onGoToAnalytics: () => void
}

const STATUS_META: Record<CalendarStatus, { label: string; color: string; bg: string; emoji: string }> = {
  idea: { label: 'Idea', color: 'text-gray-700', bg: 'bg-gray-100', emoji: '💡' },
  scripting: { label: 'Scripting', color: 'text-blue-700', bg: 'bg-blue-100', emoji: '✍️' },
  filming: { label: 'Filming', color: 'text-yellow-700', bg: 'bg-yellow-100', emoji: '🎬' },
  editing: { label: 'Editing', color: 'text-purple-700', bg: 'bg-purple-100', emoji: '🎞️' },
  scheduled: { label: 'Scheduled', color: 'text-orange-700', bg: 'bg-orange-100', emoji: '📅' },
  published: { label: 'Published', color: 'text-green-700', bg: 'bg-green-100', emoji: '🚀' },
}

function loadGoals(): PostingGoals {
  if (typeof window === 'undefined') return { weeklyTarget: 3, monthlyTarget: 12 }
  try {
    const raw = localStorage.getItem('yt-posting-goals')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { weeklyTarget: 3, monthlyTarget: 12 }
}

function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  const start = new Date(d)
  start.setDate(diff)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
}

function getMonthRange(date: Date): { start: string; end: string } {
  const y = date.getFullYear()
  const m = date.getMonth()
  return {
    start: new Date(y, m, 1).toISOString().split('T')[0],
    end: new Date(y, m + 1, 0).toISOString().split('T')[0],
  }
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function ProgressRing({ progress, size = 70, strokeWidth = 5, color = '#dc2626', children }: {
  progress: number; size?: number; strokeWidth?: number; color?: string; children?: React.ReactNode
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - Math.min(progress, 1) * circumference
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={progress >= 1 ? '#22c55e' : color}
          strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function getWeekStartDate(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function HomeDashboard({ entries, projects, onGoToCalendar, onGoToCreatorHub, onGoToSearch, onGoToAnalytics }: Props) {
  const [goals, setGoals] = useState<PostingGoals>({ weeklyTarget: 3, monthlyTarget: 12 })
  const [ytChannel, setYtChannel] = useState<YouTubeChannelData | null>(null)
  const [ytVideos, setYtVideos] = useState<YouTubeVideoData[]>([])
  const [ytLoading, setYtLoading] = useState(false)
  const now = new Date()
  const todayStr = toDateStr(now)

  useEffect(() => {
    setGoals(loadGoals())
  }, [])

  // Fetch YouTube data from cache or API
  const fetchYouTube = useCallback(async () => {
    // Try cache first
    const cachedData = localStorage.getItem('yt-channel-data')
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData)
        setYtChannel(parsed.channel)
        setYtVideos(parsed.videos || [])
        return
      } catch {}
    }

    // Fetch fresh
    setYtLoading(true)
    try {
      const res = await authFetch('/api/youtube?handle=creditcoachq')
      if (res.ok) {
        const result = await res.json()
        setYtChannel(result.channel)
        setYtVideos(result.videos || [])
        localStorage.setItem('yt-channel-data', JSON.stringify(result))
        localStorage.setItem('yt-channel-handle', 'creditcoachq')
        localStorage.setItem('yt-channel-fetched', new Date().toISOString())
      }
    } catch {}
    setYtLoading(false)
  }, [])

  useEffect(() => {
    fetchYouTube()
  }, [fetchYouTube])

  // YouTube weekly/monthly stats
  const ytStats = useMemo(() => {
    if (ytVideos.length === 0) return null

    const weekStart = getWeekStartDate(now)
    const weekStartStr = weekStart.toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const thisWeekVideos = ytVideos.filter(v => v.publishedAt >= weekStartStr)
    const thisMonthVideos = ytVideos.filter(v => v.publishedAt >= monthStart)

    const weekShorts = thisWeekVideos.filter(v => v.videoType === 'short').length
    const weekLongs = thisWeekVideos.filter(v => v.videoType === 'long').length
    const monthShorts = thisMonthVideos.filter(v => v.videoType === 'short').length
    const monthLongs = thisMonthVideos.filter(v => v.videoType === 'long').length

    const weekViews = thisWeekVideos.reduce((s, v) => s + v.viewCount, 0)
    const monthViews = thisMonthVideos.reduce((s, v) => s + v.viewCount, 0)

    // Last week for comparison
    const lastWeekStart = new Date(weekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekVideos = ytVideos.filter(v => v.publishedAt >= lastWeekStart.toISOString() && v.publishedAt < weekStartStr)
    const lastWeekTotal = lastWeekVideos.length

    return {
      weekShorts,
      weekLongs,
      weekTotal: weekShorts + weekLongs,
      monthShorts,
      monthLongs,
      monthTotal: monthShorts + monthLongs,
      weekViews,
      monthViews,
      lastWeekTotal,
      weekDelta: (weekShorts + weekLongs) - lastWeekTotal,
    }
  }, [ytVideos, now])

  const stats = useMemo(() => {
    const weekRange = getWeekRange(now)
    const monthRange = getMonthRange(now)

    const publishedThisWeek = entries.filter(e => e.status === 'published' && e.date >= weekRange.start && e.date <= weekRange.end).length
    const publishedThisMonth = entries.filter(e => e.status === 'published' && e.date >= monthRange.start && e.date <= monthRange.end).length

    // Streak
    let streak = 0
    const checkDate = new Date(now)
    while (true) {
      const wr = getWeekRange(checkDate)
      const pub = entries.filter(e => e.status === 'published' && e.date >= wr.start && e.date <= wr.end).length
      if (pub > 0) { streak++; checkDate.setDate(checkDate.getDate() - 7) } else break
    }

    // Pipeline
    const pipeline: Record<CalendarStatus, CalendarEntry[]> = {
      idea: [], scripting: [], filming: [], editing: [], scheduled: [], published: [],
    }
    entries.forEach(e => pipeline[e.status].push(e))

    // Upcoming (next 7 days)
    const weekFromNow = new Date(now)
    weekFromNow.setDate(weekFromNow.getDate() + 7)
    const weekFromNowStr = toDateStr(weekFromNow)
    const upcoming = entries
      .filter(e => e.date >= todayStr && e.date <= weekFromNowStr && e.status !== 'published')
      .sort((a, b) => a.date.localeCompare(b.date))

    // Overdue (past date, not published)
    const overdue = entries
      .filter(e => e.date < todayStr && e.status !== 'published' && e.status !== 'idea')
      .sort((a, b) => a.date.localeCompare(b.date))

    // Ready to publish (in scheduled status)
    const readyToPublish = entries.filter(e => e.status === 'scheduled')

    // Stale items (in progress for too long)
    const stale = entries.filter(e => {
      if (['published', 'idea'].includes(e.status)) return false
      const days = Math.floor((now.getTime() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24))
      return days > 7
    })

    // Weekly remaining
    const weeklyRemaining = Math.max(0, goals.weeklyTarget - publishedThisWeek)
    const monthlyRemaining = Math.max(0, goals.monthlyTarget - publishedThisMonth)

    // Days left in week
    const dayOfWeek = now.getDay()
    const daysLeftInWeek = dayOfWeek === 0 ? 0 : 7 - dayOfWeek

    return {
      publishedThisWeek,
      publishedThisMonth,
      streak,
      pipeline,
      upcoming,
      overdue,
      readyToPublish,
      stale,
      weeklyRemaining,
      monthlyRemaining,
      daysLeftInWeek,
      totalInProgress: entries.filter(e => !['idea', 'published'].includes(e.status)).length,
    }
  }, [entries, goals, todayStr, now])

  // Mini calendar for current week
  const weekDays = useMemo(() => {
    const result: { date: string; dayName: string; dayNum: number; entries: CalendarEntry[]; isToday: boolean }[] = []
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      const dateStr = toDateStr(d)
      result.push({
        date: dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        entries: entries.filter(e => e.date === dateStr),
        isToday: dateStr === todayStr,
      })
    }
    return result
  }, [entries, todayStr, now])

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = now.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [now])

  // Motivation message
  const motivation = useMemo(() => {
    if (stats.streak >= 4) return "You're on fire! Keep that streak alive."
    if (stats.publishedThisWeek >= goals.weeklyTarget) return "Weekly goal crushed! Can you do one more?"
    if (stats.weeklyRemaining === 1) return "Just 1 more video to hit your weekly goal!"
    if (stats.weeklyRemaining > 0 && stats.daysLeftInWeek <= 2) return `${stats.weeklyRemaining} videos to go and only ${stats.daysLeftInWeek} days left this week!`
    if (stats.readyToPublish.length > 0) return `You have ${stats.readyToPublish.length} video${stats.readyToPublish.length > 1 ? 's' : ''} ready to publish!`
    if (stats.overdue.length > 0) return `${stats.overdue.length} item${stats.overdue.length > 1 ? 's are' : ' is'} overdue. Let's get caught up!`
    if (stats.totalInProgress > 0) return `${stats.totalInProgress} video${stats.totalInProgress > 1 ? 's' : ''} in progress. Keep pushing!`
    return "Time to create! Start with a new video idea."
  }, [stats, goals])

  const weeklyProgress = goals.weeklyTarget > 0 ? stats.publishedThisWeek / goals.weeklyTarget : 0
  const monthlyProgress = goals.monthlyTarget > 0 ? stats.publishedThisMonth / goals.monthlyTarget : 0

  return (
    <div className="space-y-5">
      {/* Greeting + Motivation */}
      <div className="rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 p-6 text-white">
        <h2 className="text-lg font-bold">{greeting}, Coach Q</h2>
        <p className="text-sm text-gray-300 mt-1">{motivation}</p>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-xl font-bold leading-none">{stats.streak}</p>
              <p className="text-[10px] text-gray-400">week streak</p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-2xl">📹</span>
            <div>
              <p className="text-xl font-bold leading-none">{stats.totalInProgress}</p>
              <p className="text-[10px] text-gray-400">in progress</p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <div>
              <p className="text-xl font-bold leading-none">{stats.publishedThisMonth}</p>
              <p className="text-[10px] text-gray-400">published this month</p>
            </div>
          </div>
        </div>
      </div>

      {/* YouTube Channel Stats */}
      {(ytChannel || ytLoading) && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {ytChannel?.thumbnailUrl && (
                <img src={ytChannel.thumbnailUrl} alt="" className="h-8 w-8 rounded-full" />
              )}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  {ytChannel?.title || 'Loading...'}
                  <span className="text-[10px] text-gray-400 font-normal">{ytChannel?.customUrl}</span>
                </h3>
                {ytChannel && (
                  <p className="text-[10px] text-gray-400">
                    {formatNumber(ytChannel.subscriberCount)} subscribers &middot; {formatNumber(ytChannel.viewCount)} total views
                  </p>
                )}
              </div>
            </div>
            <button onClick={onGoToAnalytics} className="text-[11px] text-red-500 hover:text-red-700 font-medium">
              Full Analytics →
            </button>
          </div>

          {ytLoading && !ytStats ? (
            <div className="flex items-center gap-2 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
              <span className="text-xs text-gray-400">Loading YouTube data...</span>
            </div>
          ) : ytStats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* This Week Uploads */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">This Week</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{ytStats.weekTotal}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-blue-600 font-medium">{ytStats.weekShorts} shorts</span>
                  <span className="text-[10px] text-gray-300">|</span>
                  <span className="text-[10px] text-purple-600 font-medium">{ytStats.weekLongs} long</span>
                </div>
                {ytStats.weekDelta !== 0 && (
                  <p className={`text-[10px] font-medium mt-0.5 ${ytStats.weekDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {ytStats.weekDelta > 0 ? '↑' : '↓'} {Math.abs(ytStats.weekDelta)} vs last week
                  </p>
                )}
              </div>

              {/* This Month Uploads */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">This Month</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{ytStats.monthTotal}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-blue-600 font-medium">{ytStats.monthShorts} shorts</span>
                  <span className="text-[10px] text-gray-300">|</span>
                  <span className="text-[10px] text-purple-600 font-medium">{ytStats.monthLongs} long</span>
                </div>
              </div>

              {/* Week Views */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Week Views</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatNumber(ytStats.weekViews)}</p>
                <p className="text-[10px] text-gray-400 mt-1">from {ytStats.weekTotal} uploads</p>
              </div>

              {/* Month Views */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Month Views</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatNumber(ytStats.monthViews)}</p>
                <p className="text-[10px] text-gray-400 mt-1">from {ytStats.monthTotal} uploads</p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Goals + This Week */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Goal */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Weekly Goal</h3>
          <div className="flex items-center gap-4">
            <ProgressRing progress={weeklyProgress} size={80} strokeWidth={6}>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900 leading-none">{stats.publishedThisWeek}</p>
                <p className="text-[9px] text-gray-400">of {goals.weeklyTarget}</p>
              </div>
            </ProgressRing>
            <div>
              {weeklyProgress >= 1 ? (
                <p className="text-sm font-bold text-green-600">Goal hit!</p>
              ) : (
                <p className="text-sm font-medium text-gray-700">{stats.weeklyRemaining} more to go</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">{stats.daysLeftInWeek} days left this week</p>
            </div>
          </div>
        </div>

        {/* Monthly Goal */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Monthly Goal</h3>
          <div className="flex items-center gap-4">
            <ProgressRing progress={monthlyProgress} size={80} strokeWidth={6} color="#f97316">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900 leading-none">{stats.publishedThisMonth}</p>
                <p className="text-[9px] text-gray-400">of {goals.monthlyTarget}</p>
              </div>
            </ProgressRing>
            <div>
              {monthlyProgress >= 1 ? (
                <p className="text-sm font-bold text-green-600">Goal hit!</p>
              ) : (
                <p className="text-sm font-medium text-gray-700">{stats.monthlyRemaining} more to go</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">{now.toLocaleDateString('en-US', { month: 'long' })}</p>
            </div>
          </div>
        </div>

        {/* Pipeline Health */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Pipeline</h3>
          <div className="space-y-1.5">
            {(['idea', 'scripting', 'filming', 'editing', 'scheduled', 'published'] as CalendarStatus[]).map(status => {
              const count = stats.pipeline[status].length
              const maxCount = Math.max(...Object.values(stats.pipeline).map(a => a.length), 1)
              return (
                <div key={status} className="flex items-center gap-2">
                  <span className="text-xs w-4">{STATUS_META[status].emoji}</span>
                  <span className="text-[10px] text-gray-500 w-16">{STATUS_META[status].label}</span>
                  <div className="flex-1 h-4 bg-gray-50 rounded overflow-hidden">
                    <div className={`h-full rounded ${STATUS_META[status].bg} transition-all duration-500`}
                      style={{ width: `${(count / maxCount) * 100}%` }}>
                      {count > 0 && <span className={`text-[9px] font-bold px-1 ${STATUS_META[status].color}`}>{count}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* This Week Calendar Strip */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">This Week</h3>
          <button onClick={onGoToCalendar} className="text-[11px] text-red-500 hover:text-red-700 font-medium">
            Full Calendar →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => (
            <div
              key={day.date}
              className={`rounded-lg p-2 text-center transition ${
                day.isToday
                  ? 'bg-red-50 border-2 border-red-200'
                  : day.entries.length > 0
                    ? 'bg-gray-50 border border-gray-200'
                    : 'border border-gray-100'
              }`}
            >
              <p className={`text-[10px] font-medium ${day.isToday ? 'text-red-600' : 'text-gray-400'}`}>{day.dayName}</p>
              <p className={`text-lg font-bold ${day.isToday ? 'text-red-600' : 'text-gray-700'}`}>{day.dayNum}</p>
              <div className="space-y-0.5 mt-1">
                {day.entries.slice(0, 2).map(e => (
                  <div key={e.id} className={`rounded px-1 py-0.5 text-[8px] font-medium truncate ${STATUS_META[e.status].bg} ${STATUS_META[e.status].color}`}>
                    {STATUS_META[e.status].emoji} {e.title}
                  </div>
                ))}
                {day.entries.length > 2 && (
                  <p className="text-[8px] text-gray-400">+{day.entries.length - 2}</p>
                )}
                {day.entries.length === 0 && day.date >= todayStr && (
                  <p className="text-[8px] text-gray-300">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Urgent Items */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            ⚡ Action Items
          </h3>

          {stats.overdue.length === 0 && stats.upcoming.length === 0 && stats.readyToPublish.length === 0 && stats.stale.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-2">All caught up!</p>
              <button onClick={onGoToSearch} className="text-xs text-red-500 hover:text-red-700 font-medium">
                Find new video ideas →
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {/* Overdue */}
              {stats.overdue.map(e => (
                <div key={e.id} className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-2.5">
                  <span className="text-xs">🚨</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{e.title}</p>
                    <p className="text-[10px] text-red-500">Overdue ({e.date}) &middot; {STATUS_META[e.status].label}</p>
                  </div>
                </div>
              ))}

              {/* Ready to publish */}
              {stats.readyToPublish.map(e => (
                <div key={e.id} className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 p-2.5">
                  <span className="text-xs">🚀</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{e.title}</p>
                    <p className="text-[10px] text-green-600">Ready to publish! Scheduled for {e.date}</p>
                  </div>
                </div>
              ))}

              {/* Upcoming this week */}
              {stats.upcoming.filter(e => e.status !== 'scheduled').slice(0, 5).map(e => (
                <div key={e.id} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2.5">
                  <span className="text-xs">{STATUS_META[e.status].emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{e.title}</p>
                    <p className="text-[10px] text-gray-400">{e.date} &middot; {STATUS_META[e.status].label}</p>
                  </div>
                </div>
              ))}

              {/* Stale */}
              {stats.stale.slice(0, 3).map(e => (
                <div key={e.id} className="flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50 p-2.5">
                  <span className="text-xs">⏳</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{e.title}</p>
                    <p className="text-[10px] text-orange-500">Stuck in {STATUS_META[e.status].label} since {e.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            🎯 Quick Actions
          </h3>
          <div className="space-y-2">
            <button
              onClick={onGoToSearch}
              className="w-full flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50 hover:border-gray-200 transition text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
                <svg className="h-4 w-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900">Research Video Ideas</p>
                <p className="text-[10px] text-gray-400">Search YouTube for trending topics</p>
              </div>
            </button>

            <button
              onClick={onGoToCreatorHub}
              className="w-full flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50 hover:border-gray-200 transition text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-4 w-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900">Create Content</p>
                <p className="text-[10px] text-gray-400">Script, slides, and titles from any video</p>
              </div>
            </button>

            <button
              onClick={onGoToCalendar}
              className="w-full flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50 hover:border-gray-200 transition text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900">Manage Pipeline</p>
                <p className="text-[10px] text-gray-400">Board, calendar, and analytics</p>
              </div>
            </button>
          </div>

          {/* Recent Projects */}
          {projects.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Recent Projects</p>
              <div className="space-y-1.5">
                {projects.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-700 truncate flex-1">{p.title}</span>
                    <span className="text-[10px] text-gray-400">{new Date(p.savedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weekly Publishing Pace Check */}
      {stats.weeklyRemaining > 0 && stats.daysLeftInWeek > 0 && (
        <div className={`rounded-xl p-4 text-center ${
          stats.daysLeftInWeek <= 2 && stats.weeklyRemaining > 1
            ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white'
            : 'bg-gradient-to-r from-gray-700 to-gray-900 text-white'
        }`}>
          <p className="text-sm font-bold">
            {stats.daysLeftInWeek <= 2 && stats.weeklyRemaining > 1
              ? `⚠️ ${stats.weeklyRemaining} videos needed in ${stats.daysLeftInWeek} days!`
              : `📊 Pace check: ${stats.weeklyRemaining} video${stats.weeklyRemaining > 1 ? 's' : ''} left this week, ${stats.daysLeftInWeek} days to go`
            }
          </p>
          <p className="text-xs opacity-80 mt-1">
            {stats.weeklyRemaining <= stats.daysLeftInWeek
              ? "You're on pace. One video a day will do it."
              : "You'll need to double up on some days. Let's go!"
            }
          </p>
        </div>
      )}
      {stats.weeklyRemaining === 0 && (
        <div className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-center text-white">
          <p className="text-sm font-bold">✅ Weekly goal complete! You published {stats.publishedThisWeek} video{stats.publishedThisWeek > 1 ? 's' : ''} this week.</p>
          <p className="text-xs opacity-80 mt-1">Consistency is what separates the top 1%. Keep it up!</p>
        </div>
      )}
    </div>
  )
}
