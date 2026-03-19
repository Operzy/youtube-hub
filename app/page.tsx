'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import LoginForm from '@/components/LoginForm'
import SearchForm from '@/components/SearchForm'
import VideoCard from '@/components/VideoCard'
import TrendChart from '@/components/TrendChart'
import LibraryView from '@/components/LibraryView'
import ContentCalendar from '@/components/ContentCalendar'
import KanbanBoard from '@/components/KanbanBoard'
import ContentPipeline from '@/components/ContentPipeline'
import YouTubeAnalytics from '@/components/YouTubeAnalytics'
import CreatorHub from '@/components/CreatorHub'
import ComparisonView from '@/components/ComparisonView'
import { useSavedVideos } from '@/hooks/useSavedVideos'
import { useCalendar } from '@/hooks/useCalendar'
import { useContentLibrary } from '@/hooks/useContentLibrary'
import { VideoResult, SavedVideo, CalendarStatus, ContentProject, CalendarEntry } from '@/types/youtube'

type Tab = 'search' | 'library' | 'calendar' | 'creator' | 'content'
type CalendarView = 'calendar' | 'board'
type CalendarSection = 'pipeline' | 'youtube'
type SortMode = 'views' | 'outlier'

function outlierScore(v: VideoResult): number {
  if (!v.viewCount || !v.subscriberCount) return 0
  return v.viewCount / v.subscriberCount
}

function ContentLibraryTab({ projects, onDelete, onUpdate, onAddToCalendar }: {
  projects: ContentProject[]
  onDelete: (id: string) => void
  onUpdate: (id: string, fields: Partial<ContentProject>) => Promise<void>
  onAddToCalendar: (entry: Omit<CalendarEntry, 'id'>) => void
}) {
  const [boardFormId, setBoardFormId] = useState<string | null>(null)
  const [boardStatus, setBoardStatus] = useState<CalendarStatus>('scripting')
  const [boardDate, setBoardDate] = useState('')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [compareId, setCompareId] = useState<string | null>(null)

  if (projects.length === 0) {
    return (
      <div className="py-24 text-center text-gray-400">
        <p className="mb-2">No content saved yet.</p>
        <p className="text-xs">Create content in the Creator Hub, then save it here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {projects.map(project => (
        <div key={project.id} className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{project.title}</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Based on: {project.sourceVideoTitle} &middot; Saved {new Date(project.savedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {addedIds.has(project.id) ? (
                <span className="rounded-lg bg-green-50 border border-green-200 px-2.5 py-1 text-xs text-green-600 font-medium">
                  On Board
                </span>
              ) : (
                <button
                  onClick={() => {
                    setBoardFormId(boardFormId === project.id ? null : project.id)
                    setBoardStatus('scripting')
                    setBoardDate('')
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    boardFormId === project.id
                      ? 'border-red-300 bg-red-50 text-red-600'
                      : 'border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200'
                  }`}
                >
                  Add to Board
                </button>
              )}
              <button
                onClick={() => {
                  setCompareId(compareId === project.id ? null : project.id)
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  compareId === project.id
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : project.comparisonResult
                      ? 'border-green-200 text-green-600 hover:border-green-300'
                      : 'border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200'
                }`}
              >
                {project.comparisonResult ? 'View Comparison' : 'Compare'}
              </button>
              <button
                onClick={() => onDelete(project.id)}
                className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-400 hover:text-red-600 hover:border-red-200 transition"
              >
                Delete
              </button>
            </div>
          </div>

          {boardFormId === project.id && (
            <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="min-w-[130px]">
                <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Stage</label>
                <select
                  value={boardStatus}
                  onChange={e => setBoardStatus(e.target.value as CalendarStatus)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="idea">Idea</option>
                  <option value="scripting">Scripting</option>
                  <option value="filming">Filming</option>
                  <option value="editing">Editing</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="min-w-[150px]">
                <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Date</label>
                <input
                  type="date"
                  value={boardDate}
                  onChange={e => setBoardDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <button
                onClick={() => {
                  onAddToCalendar({
                    title: project.title,
                    date: boardDate || new Date().toISOString().split('T')[0],
                    status: boardStatus,
                    notes: `Source: ${project.sourceVideoTitle}`,
                    sourceUrl: project.sourceVideoUrl,
                  })
                  setAddedIds(prev => new Set(prev).add(project.id))
                  setBoardFormId(null)
                }}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition"
              >
                Add
              </button>
              <button
                onClick={() => setBoardFormId(null)}
                className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          )}

          {compareId === project.id && (
            <ComparisonView project={project} onUpdate={onUpdate} />
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Script */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Script</span>
                <button
                  onClick={() => navigator.clipboard.writeText(project.script)}
                  className="text-[10px] text-red-500 hover:text-red-700"
                >
                  Copy
                </button>
              </div>
              <p className="text-[11px] text-gray-600 line-clamp-4 whitespace-pre-wrap">{project.script.slice(0, 300)}...</p>
            </div>

            {/* Slides */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Slides</span>
                <button
                  onClick={() => {
                    const w = window.open('', '_blank')
                    if (w) { w.document.write(project.presentation); w.document.close() }
                  }}
                  className="text-[10px] text-red-500 hover:text-red-700"
                >
                  Open
                </button>
              </div>
              <p className="text-[11px] text-gray-600">HTML presentation included</p>
            </div>

            {/* Titles */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Titles</span>
                <button
                  onClick={() => navigator.clipboard.writeText(project.titles.join('\n'))}
                  className="text-[10px] text-red-500 hover:text-red-700"
                >
                  Copy
                </button>
              </div>
              <ul className="space-y-0.5">
                {project.titles.slice(0, 3).map((t, i) => (
                  <li key={i} className="text-[11px] text-gray-600 truncate">{i + 1}. {t}</li>
                ))}
                {project.titles.length > 3 && (
                  <li className="text-[10px] text-gray-400">+{project.titles.length - 3} more</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('search')
  const [videos, setVideos] = useState<VideoResult[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<SortMode>('views')
  const [pendingSchedule, setPendingSchedule] = useState<SavedVideo | null>(null)
  const [calView, setCalView] = useState<CalendarView>('board')
  const [calSection, setCalSection] = useState<CalendarSection>('pipeline')

  const { saved, saveVideo, unsaveVideo, isSaved } = useSavedVideos()
  const { entries, addEntry, updateEntry, deleteEntry } = useCalendar()
  const { projects, saveProject, updateProject, deleteProject } = useContentLibrary()

  function handleResults(results: VideoResult[], searchedKeyword: string) {
    setVideos(results)
    setKeyword(searchedKeyword)
    setSortBy('views')
    setTab('search')
  }

  const [pendingCreatorVideo, setPendingCreatorVideo] = useState<SavedVideo | null>(null)

  function handleOpenInCreatorHub(video: SavedVideo | VideoResult) {
    // Ensure it has savedAt for the CreatorHub (cast to SavedVideo shape)
    const asVideo: SavedVideo = 'savedAt' in video
      ? video as SavedVideo
      : { ...video, savedAt: new Date().toISOString() }
    setPendingCreatorVideo(asVideo)
    setTab('creator')
  }

  const sorted = useMemo(() => {
    return [...videos].sort((a, b) =>
      sortBy === 'views'
        ? (b.viewCount ?? 0) - (a.viewCount ?? 0)
        : outlierScore(b) - outlierScore(a)
    )
  }, [videos, sortBy])

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-none">YouTube Hub</h1>
              <p className="text-xs text-gray-500 mt-0.5">Content analysis & planning</p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 transition"
          >
            Sign Out
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-0">
            {(['search', 'library', 'calendar', 'creator', 'content'] as Tab[]).map(t => {
              const labelMap: Record<Tab, string> = {
                search: 'Search',
                library: 'Idea Library',
                calendar: 'Calendar',
                creator: 'Creator Hub',
                content: 'Content Library',
              }
              const badgeCount =
                t === 'library' ? saved.length :
                t === 'calendar' ? entries.length :
                t === 'content' ? projects.length :
                0

              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`relative px-4 py-2.5 text-sm font-medium transition ${
                    tab === t
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {badgeCount > 0 ? (
                    <span className="flex items-center gap-1.5">
                      {labelMap[t]}
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 leading-none">
                        {badgeCount}
                      </span>
                    </span>
                  ) : (
                    labelMap[t]
                  )}
                  {tab === t && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* SEARCH TAB */}
        {tab === 'search' && (
          <>
            <div className="mb-6">
              <SearchForm
                onResults={handleResults}
                onError={setError}
                onLoading={setLoading}
                loading={loading}
              />
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
                <span className="ml-3 text-gray-500">Scraping YouTube via Apify…</span>
              </div>
            )}

            {!loading && sorted.length > 0 && (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{sorted.length} videos for</span>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700 border border-red-200">
                      {keyword}
                    </span>
                  </div>

                  <div className="flex rounded-lg border border-gray-200 p-0.5">
                    <button
                      onClick={() => setSortBy('views')}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                        sortBy === 'views'
                          ? 'bg-red-600 text-white'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Most Viewed
                    </button>
                    <button
                      onClick={() => setSortBy('outlier')}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                        sortBy === 'outlier'
                          ? 'bg-red-600 text-white'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Outlier Score
                    </button>
                  </div>
                </div>

                <TrendChart videos={videos} metric={sortBy} />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sorted.map((video, i) => (
                    <VideoCard
                      key={video.url ?? i}
                      video={video}
                      rank={i + 1}
                      sortBy={sortBy}
                      searchTerm={keyword}
                      isSaved={isSaved(video.url)}
                      onSave={saveVideo}
                      onUnsave={unsaveVideo}
                      onOpenInCreatorHub={handleOpenInCreatorHub}
                    />
                  ))}
                </div>
              </>
            )}

            {!loading && sorted.length === 0 && !error && (
              <div className="py-24 text-center text-gray-400">
                Enter a keyword above to start researching
              </div>
            )}
          </>
        )}

        {/* LIBRARY TAB */}
        {tab === 'library' && (
          <LibraryView saved={saved} onUnsave={unsaveVideo} onOpenInCreatorHub={handleOpenInCreatorHub} />
        )}

        {/* CALENDAR TAB */}
        {tab === 'calendar' && (
          <>
            {/* Section Toggle: Pipeline vs YouTube Analytics */}
            <div className="mb-5 flex rounded-lg border border-gray-200 p-0.5 w-fit">
              <button
                onClick={() => setCalSection('pipeline')}
                className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${
                  calSection === 'pipeline' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 6-6" />
                </svg>
                Content Pipeline
              </button>
              <button
                onClick={() => setCalSection('youtube')}
                className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${
                  calSection === 'youtube' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTube Analytics
              </button>
            </div>

            {/* Pipeline Dashboard */}
            {calSection === 'pipeline' && <ContentPipeline entries={entries} />}

            {/* YouTube Analytics */}
            {calSection === 'youtube' && <YouTubeAnalytics />}

            {/* View Toggle + Board/Calendar (only in pipeline section) */}
            {calSection === 'pipeline' && (
              <>
                <div className="mt-6 mb-5 flex items-center justify-between">
                  <p className="text-sm text-gray-500 font-medium">
                    {entries.length} {entries.length === 1 ? 'item' : 'items'} in pipeline
                  </p>
                  <div className="flex rounded-lg border border-gray-200 p-0.5">
                    <button
                      onClick={() => setCalView('board')}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        calView === 'board' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="1" y="1" width="4" height="14" rx="1" />
                        <rect x="6" y="1" width="4" height="14" rx="1" />
                        <rect x="11" y="1" width="4" height="14" rx="1" />
                      </svg>
                      Board
                    </button>
                    <button
                      onClick={() => setCalView('calendar')}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        calView === 'calendar' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="1" y="2" width="14" height="13" rx="1" />
                        <path d="M1 6h14M5 1v2M11 1v2" />
                      </svg>
                      Calendar
                    </button>
                  </div>
                </div>

                {calView === 'board' ? (
                  <KanbanBoard
                    entries={entries}
                    onAdd={addEntry}
                    onUpdate={updateEntry}
                    onDelete={deleteEntry}
                  />
                ) : (
                  <ContentCalendar
                    entries={entries}
                    onAdd={addEntry}
                    onUpdate={updateEntry}
                    onDelete={deleteEntry}
                    pendingVideo={pendingSchedule}
                    onPendingConsumed={() => setPendingSchedule(null)}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* CREATOR HUB TAB */}
        {tab === 'creator' && (
          <CreatorHub
            saved={saved}
            onSaveProject={saveProject}
            onAddToCalendar={addEntry}
            pendingVideo={pendingCreatorVideo}
            onPendingConsumed={() => setPendingCreatorVideo(null)}
          />
        )}

        {/* CONTENT LIBRARY TAB */}
        {tab === 'content' && (
          <ContentLibraryTab
            projects={projects}
            onDelete={deleteProject}
            onUpdate={updateProject}
            onAddToCalendar={addEntry}
          />
        )}
      </div>
    </main>
  )
}

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setAuthed(false)
  }

  if (authed === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    )
  }

  if (!authed) {
    return <LoginForm onLogin={() => setAuthed(true)} />
  }

  return <Dashboard onSignOut={handleSignOut} />
}
