import { VideoResult } from '@/types/youtube'

interface Props {
  video: VideoResult
  rank: number
  sortBy: 'views' | 'outlier'
  searchTerm: string
  isSaved: boolean
  onSave: (video: VideoResult) => void
  onUnsave: (url: string) => void
  onOpenInCreatorHub: (video: VideoResult) => void
}

function fmt(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function outlierScore(v: VideoResult): number {
  if (!v.viewCount || !v.subscriberCount) return 0
  return v.viewCount / v.subscriberCount
}

export default function VideoCard({ video, rank, sortBy, isSaved, onSave, onUnsave, onOpenInCreatorHub }: Props) {
  return (
    <div className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="relative">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title ?? ''}
            className="w-full aspect-video object-cover"
          />
        ) : (
          <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
            No thumbnail
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-bold text-white">
          #{rank}
        </span>
        {outlierScore(video) > 0 && (
          <span className={`absolute top-2 right-2 rounded-md px-2 py-0.5 text-xs font-bold ${
            outlierScore(video) >= 5
              ? 'bg-red-600 text-white'
              : outlierScore(video) >= 2
                ? 'bg-orange-500 text-white'
                : 'bg-black/70 text-white'
          }`}>
            {outlierScore(video).toFixed(1)}x
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">
          {video.url ? (
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="hover:text-red-600 transition-colors">
              {video.title}
            </a>
          ) : (
            video.title
          )}
        </h3>

        {/* Channel */}
        <p className="text-xs text-gray-500 mb-3">{video.channelName ?? 'Unknown channel'}</p>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {fmt(video.viewCount)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            {fmt(video.subscriberCount)}
          </span>
        </div>

        {video.uploadDate && (
          <p className="text-[11px] text-gray-400 mb-3">{video.uploadDate}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => isSaved ? onUnsave(video.url!) : onSave(video)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              isSaved
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isSaved ? 'Saved' : 'Save'}
          </button>
          {video.type !== 'shorts' && (
            <button
              onClick={() => onOpenInCreatorHub(video)}
              className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition"
            >
              Creator Hub
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
