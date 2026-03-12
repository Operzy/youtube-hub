'use client'

import { SavedVideo } from '@/types/youtube'

interface Props {
  saved: SavedVideo[]
  onUnsave: (url: string) => void
  onOpenInCreatorHub: (video: SavedVideo) => void
}

function fmt(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function VideoRow({ video, onUnsave, onOpenInCreatorHub, isShort }: {
  video: SavedVideo
  onUnsave: (url: string) => void
  onOpenInCreatorHub: (video: SavedVideo) => void
  isShort: boolean
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt={video.title ?? ''}
          className={`rounded-lg object-cover flex-shrink-0 ${isShort ? 'w-24 aspect-[9/16]' : 'w-40 aspect-video'}`}
        />
      ) : (
        <div className={`rounded-lg bg-gray-100 flex-shrink-0 ${isShort ? 'w-24 aspect-[9/16]' : 'w-40 aspect-video'}`} />
      )}

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
          {video.url ? (
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="hover:text-red-600">
              {video.title}
            </a>
          ) : (
            video.title
          )}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">{video.channelName}</p>

        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>{fmt(video.viewCount)} views</span>
          <span>{fmt(video.subscriberCount)} subs</span>
          {video.uploadDate && <span>{video.uploadDate}</span>}
        </div>

        <div className="flex items-center gap-2 mt-3">
          {!isShort && (
            <button
              onClick={() => onOpenInCreatorHub(video)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition"
            >
              Open in Creator Hub
            </button>
          )}
          <button
            onClick={() => video.url && onUnsave(video.url)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:border-red-200 transition"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LibraryView({ saved, onUnsave, onOpenInCreatorHub }: Props) {
  const longVideos = saved.filter(v => v.type !== 'shorts')
  const shorts = saved.filter(v => v.type === 'shorts')

  if (!saved.length) {
    return (
      <div className="py-24 text-center text-gray-400">
        No saved videos yet. Search and save videos to build your library.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {longVideos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Videos
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{longVideos.length}</span>
          </h3>
          <div className="space-y-3">
            {longVideos.map(video => (
              <VideoRow
                key={video.url}
                video={video}
                onUnsave={onUnsave}
                onOpenInCreatorHub={onOpenInCreatorHub}
                isShort={false}
              />
            ))}
          </div>
        </div>
      )}

      {shorts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 8l3 2-3 2V8z"/></svg>
            Shorts
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{shorts.length}</span>
          </h3>
          <div className="space-y-3">
            {shorts.map(video => (
              <VideoRow
                key={video.url}
                video={video}
                onUnsave={onUnsave}
                onOpenInCreatorHub={onOpenInCreatorHub}
                isShort={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
