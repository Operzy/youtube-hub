'use client'

import { useState, useMemo, useEffect } from 'react'
import { CalendarEntry, CalendarStatus, PostingGoals } from '@/types/youtube'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface Props {
  entries: CalendarEntry[]
}

const STAGE_META: Record<CalendarStatus, { label: string; color: string; emoji: string }> = {
  idea: { label: 'Ideas', color: '#9ca3af', emoji: '💡' },
  scripting: { label: 'Scripting', color: '#3b82f6', emoji: '✍️' },
  filming: { label: 'Filming', color: '#eab308', emoji: '🎬' },
  editing: { label: 'Editing', color: '#a855f7', emoji: '🎞️' },
  scheduled: { label: 'Scheduled', color: '#f97316', emoji: '📅' },
  published: { label: 'Published', color: '#22c55e', emoji: '🚀' },
}

const STAGES: CalendarStatus[] = ['idea', 'scripting', 'filming', 'editing', 'scheduled', 'published']

function loadGoals(): PostingGoals {
  if (typeof window === 'undefined') return { weeklyTarget: 3, monthlyTarget: 12 }
  try {
    const raw = localStorage.getItem('yt-posting-goals')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { weeklyTarget: 3, monthlyTarget: 12 }
}

function saveGoals(goals: PostingGoals) {
  localStorage.setItem('yt-posting-goals', JSON.stringify(goals))
}

function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  const start = new Date(d)
  start.setDate(diff)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function getMonthRange(date: Date): { start: string; end: string } {
  const y = date.getFullYear()
  const m = date.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function ProgressRing({ progress, size = 80, strokeWidth = 6, color = '#dc2626', children }: {
  progress: number; size?: number; strokeWidth?: number; color?: string; children?: React.ReactNode
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - Math.min(progress, 1) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={progress >= 1 ? '#22c55e' : color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}

function ActivityHeatmap({ entries }: { entries: CalendarEntry[] }) {
  const weeks = useMemo(() => {
    const today = new Date()
    const result: { date: string; count: number; isToday: boolean }[][] = []
    // 12 weeks back
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 83) // ~12 weeks
    startDate.setDate(startDate.getDate() - startDate.getDay()) // align to Sunday

    const publishedDates = new Map<string, number>()
    entries.forEach(e => {
      if (e.status === 'published') {
        publishedDates.set(e.date, (publishedDates.get(e.date) || 0) + 1)
      }
    })

    const allDates = new Map<string, number>()
    entries.forEach(e => {
      allDates.set(e.date, (allDates.get(e.date) || 0) + 1)
    })

    const current = new Date(startDate)
    while (current <= today) {
      const week: { date: string; count: number; isToday: boolean }[] = []
      for (let d = 0; d < 7; d++) {
        const dateStr = current.toISOString().split('T')[0]
        const isToday = dateStr === today.toISOString().split('T')[0]
        if (current <= today) {
          week.push({
            date: dateStr,
            count: allDates.get(dateStr) || 0,
            isToday,
          })
        }
        current.setDate(current.getDate() + 1)
      }
      result.push(week)
    }
    return result
  }, [entries])

  function getColor(count: number) {
    if (count === 0) return 'bg-gray-100'
    if (count === 1) return 'bg-red-200'
    if (count === 2) return 'bg-red-400'
    return 'bg-red-600'
  }

  return (
    <div>
      <div className="flex gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.date}
                className={`h-[13px] w-[13px] rounded-[2px] ${getColor(day.count)} ${day.isToday ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                title={`${day.date}: ${day.count} ${day.count === 1 ? 'item' : 'items'}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-gray-400">Less</span>
        <div className="flex gap-[2px]">
          {['bg-gray-100', 'bg-red-200', 'bg-red-400', 'bg-red-600'].map(c => (
            <div key={c} className={`h-[10px] w-[10px] rounded-[2px] ${c}`} />
          ))}
        </div>
        <span className="text-[10px] text-gray-400">More</span>
      </div>
    </div>
  )
}

export default function ContentPipeline({ entries }: Props) {
  const [goals, setGoals] = useState<PostingGoals>({ weeklyTarget: 3, monthlyTarget: 12 })
  const [editingGoals, setEditingGoals] = useState(false)
  const [tempWeekly, setTempWeekly] = useState(3)
  const [tempMonthly, setTempMonthly] = useState(12)

  useEffect(() => {
    const loaded = loadGoals()
    setGoals(loaded)
    setTempWeekly(loaded.weeklyTarget)
    setTempMonthly(loaded.monthlyTarget)
  }, [])

  // Stats calculations
  const stats = useMemo(() => {
    const now = new Date()
    const weekRange = getWeekRange(now)
    const monthRange = getMonthRange(now)

    const publishedThisWeek = entries.filter(
      e => e.status === 'published' && e.date >= weekRange.start && e.date <= weekRange.end
    ).length

    const publishedThisMonth = entries.filter(
      e => e.status === 'published' && e.date >= monthRange.start && e.date <= monthRange.end
    ).length

    // Calculate streak (consecutive weeks with at least 1 published video)
    let streak = 0
    const checkDate = new Date(now)
    while (true) {
      const wr = getWeekRange(checkDate)
      const published = entries.filter(
        e => e.status === 'published' && e.date >= wr.start && e.date <= wr.end
      ).length
      if (published > 0) {
        streak++
        checkDate.setDate(checkDate.getDate() - 7)
      } else {
        break
      }
    }

    // Pipeline counts
    const pipeline: Record<CalendarStatus, number> = {
      idea: 0, scripting: 0, filming: 0, editing: 0, scheduled: 0, published: 0,
    }
    entries.forEach(e => { pipeline[e.status]++ })

    // In-progress (everything not idea and not published)
    const inProgress = entries.filter(e => !['idea', 'published'].includes(e.status)).length

    // Next scheduled item
    const todayStr = now.toISOString().split('T')[0]
    const upcoming = entries
      .filter(e => e.date >= todayStr && e.status !== 'published')
      .sort((a, b) => a.date.localeCompare(b.date))
    const nextDeadline = upcoming[0] || null

    // Days until next deadline
    let daysUntilNext: number | null = null
    if (nextDeadline) {
      const diff = new Date(nextDeadline.date).getTime() - now.getTime()
      daysUntilNext = Math.ceil(diff / (1000 * 60 * 60 * 24))
    }

    return {
      publishedThisWeek,
      publishedThisMonth,
      streak,
      pipeline,
      inProgress,
      nextDeadline,
      daysUntilNext,
      total: entries.length,
    }
  }, [entries])

  // Pipeline funnel data for chart
  const funnelData = useMemo(() => {
    return STAGES.map(status => ({
      name: STAGE_META[status].label,
      count: stats.pipeline[status],
      color: STAGE_META[status].color,
      emoji: STAGE_META[status].emoji,
    }))
  }, [stats.pipeline])

  // Weekly activity data (last 8 weeks)
  const weeklyData = useMemo(() => {
    const result: { week: string; published: number; total: number }[] = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      const wr = getWeekRange(d)
      const published = entries.filter(
        e => e.status === 'published' && e.date >= wr.start && e.date <= wr.end
      ).length
      const total = entries.filter(
        e => e.date >= wr.start && e.date <= wr.end
      ).length
      const startDate = new Date(wr.start)
      result.push({
        week: `${startDate.getMonth() + 1}/${startDate.getDate()}`,
        published,
        total,
      })
    }
    return result
  }, [entries])

  function handleSaveGoals() {
    const newGoals = { weeklyTarget: tempWeekly, monthlyTarget: tempMonthly }
    setGoals(newGoals)
    saveGoals(newGoals)
    setEditingGoals(false)
  }

  const weeklyProgress = goals.weeklyTarget > 0 ? stats.publishedThisWeek / goals.weeklyTarget : 0
  const monthlyProgress = goals.monthlyTarget > 0 ? stats.publishedThisMonth / goals.monthlyTarget : 0

  return (
    <div className="space-y-5">
      {/* Row 1: Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Streak */}
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-orange-50 to-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔥</span>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Streak</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.streak} <span className="text-sm font-normal text-gray-400">{stats.streak === 1 ? 'week' : 'weeks'}</span></p>
          <p className="text-[10px] text-gray-400 mt-1">Consecutive weeks posting</p>
        </div>

        {/* In Progress */}
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚡</span>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.inProgress} <span className="text-sm font-normal text-gray-400">videos</span></p>
          <p className="text-[10px] text-gray-400 mt-1">Scripting through editing</p>
        </div>

        {/* Total Published */}
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🚀</span>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Published</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.pipeline.published} <span className="text-sm font-normal text-gray-400">total</span></p>
          <p className="text-[10px] text-gray-400 mt-1">{stats.publishedThisMonth} this month</p>
        </div>

        {/* Next Deadline */}
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-red-50 to-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⏰</span>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Next Up</span>
          </div>
          {stats.nextDeadline ? (
            <>
              <p className="text-sm font-bold text-gray-900 line-clamp-1">{stats.nextDeadline.title}</p>
              <p className={`text-xs font-medium mt-1 ${
                stats.daysUntilNext !== null && stats.daysUntilNext <= 1 ? 'text-red-600' :
                stats.daysUntilNext !== null && stats.daysUntilNext <= 3 ? 'text-orange-500' : 'text-gray-500'
              }`}>
                {stats.daysUntilNext === 0 ? 'Today!' :
                 stats.daysUntilNext === 1 ? 'Tomorrow' :
                 `In ${stats.daysUntilNext} days`}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-1">No upcoming items</p>
          )}
        </div>
      </div>

      {/* Row 2: Goals + Activity Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Goals */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              🎯 Posting Goals
            </h3>
            <button
              onClick={() => {
                if (editingGoals) handleSaveGoals()
                else setEditingGoals(true)
              }}
              className="text-[11px] font-medium text-red-500 hover:text-red-700 transition"
            >
              {editingGoals ? 'Save' : 'Edit'}
            </button>
          </div>

          {editingGoals ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Weekly Target</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={tempWeekly}
                  onChange={e => setTempWeekly(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Monthly Target</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={tempMonthly}
                  onChange={e => setTempMonthly(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setEditingGoals(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-around">
              <div className="text-center">
                <ProgressRing progress={weeklyProgress} size={90} strokeWidth={7}>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 leading-none">{stats.publishedThisWeek}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">of {goals.weeklyTarget}</p>
                  </div>
                </ProgressRing>
                <p className="text-[11px] font-medium text-gray-600 mt-2">This Week</p>
                {weeklyProgress >= 1 && <p className="text-[10px] text-green-600 font-bold">Goal hit!</p>}
              </div>
              <div className="text-center">
                <ProgressRing progress={monthlyProgress} size={90} strokeWidth={7} color="#f97316">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 leading-none">{stats.publishedThisMonth}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">of {goals.monthlyTarget}</p>
                  </div>
                </ProgressRing>
                <p className="text-[11px] font-medium text-gray-600 mt-2">This Month</p>
                {monthlyProgress >= 1 && <p className="text-[10px] text-green-600 font-bold">Goal hit!</p>}
              </div>
            </div>
          )}
        </div>

        {/* Activity Heatmap */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            📊 Activity (Last 12 Weeks)
          </h3>
          <ActivityHeatmap entries={entries} />
          <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-400">
            <span>Content activity across your pipeline</span>
          </div>
        </div>
      </div>

      {/* Row 3: Pipeline Funnel + Weekly Publishing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Funnel */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            🔄 Content Pipeline
          </h3>
          <div className="space-y-2">
            {funnelData.map((stage, i) => {
              const maxCount = Math.max(...funnelData.map(s => s.count), 1)
              const widthPercent = Math.max((stage.count / maxCount) * 100, 8)
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <span className="text-sm w-5 text-center">{stage.emoji}</span>
                  <span className="text-[11px] font-medium text-gray-600 w-20">{stage.name}</span>
                  <div className="flex-1 h-7 bg-gray-50 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg flex items-center px-2 transition-all duration-500"
                      style={{ width: `${widthPercent}%`, backgroundColor: stage.color }}
                    >
                      <span className="text-[11px] font-bold text-white drop-shadow-sm">{stage.count}</span>
                    </div>
                  </div>
                  {i < funnelData.length - 1 && (
                    <span className="text-gray-300 text-xs">→</span>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">{stats.total} total items in pipeline</p>
        </div>

        {/* Weekly Publishing Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            📈 Weekly Output
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData} barCategoryGap="20%">
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="published" name="Published" radius={[4, 4, 0, 0]}>
                {weeklyData.map((entry, i) => (
                  <Cell key={i} fill={entry.published >= goals.weeklyTarget ? '#22c55e' : '#dc2626'} />
                ))}
              </Bar>
              <Bar dataKey="total" name="All Activity" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-red-600" />
              <span className="text-[10px] text-gray-400">Published (red = below goal)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-green-500" />
              <span className="text-[10px] text-gray-400">Goal met</span>
            </div>
          </div>
        </div>
      </div>

      {/* Motivational Banner */}
      {stats.streak >= 2 && (
        <div className="rounded-xl bg-gradient-to-r from-red-600 to-orange-500 p-4 text-white text-center">
          <p className="text-sm font-bold">
            🔥 {stats.streak}-week streak! Keep the momentum going!
          </p>
          <p className="text-xs opacity-80 mt-1">
            Consistency is the #1 factor in YouTube growth. You&apos;re doing great!
          </p>
        </div>
      )}
      {stats.streak === 0 && entries.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-gray-700 to-gray-900 p-4 text-white text-center">
          <p className="text-sm font-bold">
            💪 Time to start your streak! Publish a video this week.
          </p>
          <p className="text-xs opacity-80 mt-1">
            Move your content through the pipeline — consistency beats perfection.
          </p>
        </div>
      )}
    </div>
  )
}
