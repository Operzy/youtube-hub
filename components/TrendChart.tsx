'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { VideoResult } from '@/types/youtube'

interface Props {
  videos: VideoResult[]
  metric: 'views' | 'outlier'
}

function shortTitle(t: string | null, max = 25): string {
  if (!t) return '(no title)'
  return t.length > max ? t.slice(0, max) + '…' : t
}

export default function TrendChart({ videos, metric }: Props) {
  const data = useMemo(() => {
    const sorted = [...videos].sort((a, b) => {
      if (metric === 'views') return (b.viewCount ?? 0) - (a.viewCount ?? 0)
      const scoreA = a.viewCount && a.subscriberCount ? a.viewCount / a.subscriberCount : 0
      const scoreB = b.viewCount && b.subscriberCount ? b.viewCount / b.subscriberCount : 0
      return scoreB - scoreA
    })

    return sorted.slice(0, 10).map(v => ({
      name: shortTitle(v.title),
      value:
        metric === 'views'
          ? v.viewCount ?? 0
          : v.viewCount && v.subscriberCount
            ? Math.round((v.viewCount / v.subscriberCount) * 10) / 10
            : 0,
    }))
  }, [videos, metric])

  if (!data.length) return null

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-700">
        Top 10 by {metric === 'views' ? 'Views' : 'Outlier Score'}
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(val) =>
              metric === 'views' ? Number(val).toLocaleString() : val + 'x'
            }
          />
          <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
