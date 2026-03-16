'use client'

import { useState, useRef, useEffect } from 'react'
import { SavedVideo, ContentProject, CalendarEntry, CalendarStatus, ScoreItem } from '@/types/youtube'
import { authFetch } from '@/lib/api-client'

type Step = 'select' | 'transcript' | 'analyze' | 'script' | 'presentation' | 'titles' | 'finish'

interface Props {
  saved: SavedVideo[]
  onSaveProject: (project: Omit<ContentProject, 'id' | 'savedAt'>) => string
  onAddToCalendar: (entry: Omit<CalendarEntry, 'id'>) => void
  pendingVideo?: SavedVideo | null
  onPendingConsumed?: () => void
}

function fmt(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'select', label: 'Source', icon: '1' },
  { key: 'transcript', label: 'Transcript', icon: '2' },
  { key: 'analyze', label: 'Analyze', icon: '3' },
  { key: 'script', label: 'Script', icon: '4' },
  { key: 'presentation', label: 'Slides', icon: '5' },
  { key: 'titles', label: 'Titles', icon: '6' },
  { key: 'finish', label: 'Finish', icon: '7' },
]

export default function CreatorHub({ saved, onSaveProject, onAddToCalendar, pendingVideo, onPendingConsumed }: Props) {
  const [step, setStep] = useState<Step>('select')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [script, setScript] = useState('')
  const [presentation, setPresentation] = useState('')
  const [titles, setTitles] = useState('')
  const [titlesList, setTitlesList] = useState<string[]>([])
  const [projectSaved, setProjectSaved] = useState(false)
  const [scores, setScores] = useState<ScoreItem[]>([])
  const [expandedScore, setExpandedScore] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [myTopic, setMyTopic] = useState('')
  const [slideCount, setSlideCount] = useState(8)
  const [slideChat, setSlideChat] = useState('')
  const [slideChatHistory, setSlideChatHistory] = useState<{ role: string; content: string }[]>([])
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>('scripting')
  const [calendarDate, setCalendarDate] = useState('')
  const [addedToCalendar, setAddedToCalendar] = useState(false)
  const presentationRef = useRef<HTMLIFrameElement>(null)
  const slideChatRef = useRef<HTMLDivElement>(null)

  // Auto-select video when opened from Idea Library
  useEffect(() => {
    if (pendingVideo?.url) {
      selectVideo(pendingVideo)
      onPendingConsumed?.()
      // Auto-fetch transcript
      setLoading(true)
      setError('')
      authFetch('/api/transcript', {
        method: 'POST',
        body: JSON.stringify({ videoUrl: pendingVideo.url }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error)
          setTranscript(data.transcript)
          if (!pendingVideo?.title && data.title) setVideoTitle(data.title)
          setStep('transcript')
        })
        .catch(err => setError(err instanceof Error ? err.message : 'Failed to fetch transcript'))
        .finally(() => setLoading(false))
    }
  }, [pendingVideo])

  // ── helpers ──

  async function streamChat(promptType: string, userMessage: string): Promise<string> {
    const res = await authFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        promptType,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'AI request failed' }))
      throw new Error(data.error || 'AI request failed')
    }
    return res.text()
  }

  async function fetchTranscript() {
    if (!videoUrl) return
    setLoading(true)
    setError('')
    try {
      const res = await authFetch('/api/transcript', {
        method: 'POST',
        body: JSON.stringify({ videoUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch transcript')
      setTranscript(data.transcript)
      // Set metadata from transcript response if we don't already have it
      if (!videoTitle && data.title) setVideoTitle(data.title)
      setStep('transcript')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transcript')
    } finally {
      setLoading(false)
    }
  }

  async function runAnalysis() {
    setLoading(true)
    setError('')
    try {
      // Run both requests in parallel: detailed analysis + structured scores
      const [analysisResult, scoresResult] = await Promise.all([
        streamChat(
          'analyze',
          `Analyze this YouTube video transcript. Break down:\n\n1. **Hook** (first 30 seconds) — what grabbed attention?\n2. **Structure** — how was the content organized?\n3. **Key Points** — main topics covered\n4. **CTAs** — calls to action used\n5. **Pacing** — how did energy/tempo flow?\n6. **What Made It Work** — why this video performed\n7. **Gaps/Opportunities** — what could be improved or expanded on\n\nVideo: "${videoTitle}"\n\nTranscript:\n${transcript.slice(0, 8000)}`
        ),
        streamChat(
          'score',
          `Score this YouTube video transcript on each element. Return a JSON array with exactly this structure:
[
  {"label": "Hook", "score": <1-10>, "summary": "<one sentence on what was done>", "improvements": ["<specific improvement 1>", "<specific improvement 2>", "<specific improvement 3>"]},
  {"label": "Structure", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "Storytelling", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "CTAs", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "Pacing", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "Value Density", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "Engagement", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "SEO / Discoverability", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]}
]

Video: "${videoTitle}"\n\nTranscript:\n${transcript.slice(0, 6000)}`
        ),
      ])

      setAnalysis(analysisResult)

      // Parse scores JSON
      try {
        let jsonStr = scoresResult.trim()
        // Extract JSON array if wrapped in code blocks
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
        if (jsonMatch) jsonStr = jsonMatch[0]
        const parsed = JSON.parse(jsonStr) as ScoreItem[]
        setScores(parsed)
      } catch {
        // If JSON parsing fails, set empty scores (analysis still shows)
        setScores([])
      }

      setStep('analyze')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  async function generateScript() {
    if (!myTopic.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await streamChat(
        'script',
        `Write a complete YouTube script for Credit Coach Q on the topic: "${myTopic}"\n\nUse insights from this analysis of a reference video:\n${analysis.slice(0, 4000)}\n\nThe script should include:\n- A strong hook (first 15 seconds)\n- Clear intro with topic preview\n- 3-5 main sections with transitions\n- Engagement prompts (like, subscribe, comment)\n- Strong closing CTA\n- Approximate timestamps\n\nFormat it clearly with section headers and speaker directions in [brackets].`
      )
      setScript(result)
      setStep('script')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Script generation failed')
    } finally {
      setLoading(false)
    }
  }

  async function generatePresentation() {
    setLoading(true)
    setError('')
    try {
      const result = await streamChat(
        'presentation',
        `Create a ${slideCount}-slide HTML presentation based on this script:\n\n${script.slice(0, 6000)}\n\nSlide guidelines:\n- Slide 1: Title slide with the video topic\n- Middle slides: One key point per slide with a short bullet or visual text\n- Last slide: CTA / closing\n- Keep text large and minimal (max 3-4 lines per slide)\n- Add slide numbers\n- Use subtle animations/transitions between slides`
      )
      // Extract HTML from the response (may be wrapped in code blocks)
      let html = result
      // Try closed code block first, then unclosed (if output was long)
      const closedMatch = html.match(/```html?\s*([\s\S]*?)```/)
      const openMatch = html.match(/```html?\s*([\s\S]*)/)
      if (closedMatch) {
        html = closedMatch[1]
      } else if (openMatch) {
        html = openMatch[1]
      }
      // If it doesn't look like HTML, try to find the doctype/html tag
      if (!html.trim().startsWith('<!') && !html.trim().startsWith('<html')) {
        const htmlStart = html.indexOf('<!DOCTYPE') !== -1 ? html.indexOf('<!DOCTYPE') : html.indexOf('<html')
        if (htmlStart !== -1) {
          html = html.slice(htmlStart)
        }
      }
      setPresentation(html)
      setStep('presentation')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Presentation generation failed')
    } finally {
      setLoading(false)
    }
  }

  async function adjustSlides(userRequest: string) {
    if (!userRequest.trim()) return
    setLoading(true)
    setError('')
    const newMsg = { role: 'user', content: userRequest }
    setSlideChatHistory(prev => [...prev, newMsg])
    setSlideChat('')
    try {
      const result = await streamChat(
        'presentation-edit',
        `Here is the current HTML presentation:\n\n${presentation}\n\nUser request: ${userRequest}`
      )
      // Extract HTML
      let html = result
      const closedMatch = html.match(/```html?\s*([\s\S]*?)```/)
      const openMatch = html.match(/```html?\s*([\s\S]*)/)
      if (closedMatch) {
        html = closedMatch[1]
      } else if (openMatch) {
        html = openMatch[1]
      }
      if (!html.trim().startsWith('<!') && !html.trim().startsWith('<html')) {
        const htmlStart = html.indexOf('<!DOCTYPE') !== -1 ? html.indexOf('<!DOCTYPE') : html.indexOf('<html')
        if (htmlStart !== -1) {
          html = html.slice(htmlStart)
        }
      }
      setPresentation(html)
      setSlideChatHistory(prev => [...prev, { role: 'assistant', content: 'Slides updated!' }])
      // Scroll chat to bottom
      setTimeout(() => slideChatRef.current?.scrollTo(0, slideChatRef.current.scrollHeight), 100)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to adjust slides'
      setSlideChatHistory(prev => [...prev, { role: 'assistant', content: `Error: ${errMsg}` }])
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }

  async function generateTitles() {
    setLoading(true)
    setError('')
    try {
      const result = await streamChat(
        'titles',
        `Generate 10 compelling YouTube title ideas for this video. They should be similar in style to: "${videoTitle}"\n\nScript topic: ${myTopic}\n\nScript excerpt:\n${script.slice(0, 2000)}\n\nRules:\n- Each title under 60 characters\n- Curiosity-driven, high CTR\n- Credit repair / business funding / finance niche\n- Return ONLY the numbered list, nothing else`
      )
      setTitles(result)
      // Parse numbered list into array
      const parsed = result
        .split('\n')
        .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(line => line.length > 0)
      setTitlesList(parsed)
      setStep('titles')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Title generation failed')
    } finally {
      setLoading(false)
    }
  }

  function selectVideo(video: SavedVideo) {
    setVideoUrl(video.url ?? '')
    setVideoTitle(video.title ?? '')
    // Reset downstream state
    setTranscript('')
    setAnalysis('')
    setScores([])
    setExpandedScore(null)
    setScript('')
    setPresentation('')
    setSlideChatHistory([])
    setSlideChat('')
    setTitles('')
    setTitlesList([])
    setProjectSaved(false)
    setAddedToCalendar(false)
    setCalendarDate('')
    setCalendarStatus('scripting')
    setMyTopic('')
  }

  function downloadPresentation() {
    const blob = new Blob([presentation], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${myTopic || 'presentation'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  function canGoTo(s: Step): boolean {
    switch (s) {
      case 'select': return true
      case 'transcript': return !!videoUrl
      case 'analyze': return !!transcript
      case 'script': return !!analysis
      case 'presentation': return !!script
      case 'titles': return !!script
      case 'finish': return !!script && !!presentation && titlesList.length > 0
    }
  }

  function handleSaveProject() {
    onSaveProject({
      title: myTopic,
      sourceVideoTitle: videoTitle,
      sourceVideoUrl: videoUrl,
      script,
      presentation,
      titles: titlesList,
      sourceTranscript: transcript,
      sourceScores: scores,
    })
    setProjectSaved(true)
  }

  // ── render ──

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <button
              onClick={() => canGoTo(s.key) && setStep(s.key)}
              disabled={!canGoTo(s.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                step === s.key
                  ? 'bg-red-600 text-white'
                  : canGoTo(s.key)
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-300 cursor-not-allowed'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                step === s.key ? 'bg-white/20' : 'bg-gray-200 text-gray-500'
              }`}>
                {s.icon}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <svg className="mx-1 h-3 w-3 text-gray-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      {loading && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
          <span className="text-sm text-blue-700">Working on it…</span>
        </div>
      )}

      {/* ── STEP: SELECT SOURCE ── */}
      {step === 'select' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Paste a YouTube URL</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={videoUrl}
                onChange={e => { setVideoUrl(e.target.value); setVideoTitle('') }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button
                onClick={fetchTranscript}
                disabled={!videoUrl || loading}
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                Pull Transcript
              </button>
            </div>
          </div>

          {saved.filter(v => v.type !== 'shorts').length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Or pick from your Library</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {saved.filter(v => v.type !== 'shorts').map(video => (
                  <button
                    key={video.url}
                    onClick={async () => {
                      selectVideo(video)
                      if (!video.url) return
                      setLoading(true)
                      setError('')
                      try {
                        const res = await authFetch('/api/transcript', {
                          method: 'POST',
                          body: JSON.stringify({ videoUrl: video.url }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(data.error || 'Failed to fetch transcript')
                        setTranscript(data.transcript)
                        setStep('transcript')
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch transcript')
                      } finally {
                        setLoading(false)
                      }
                    }}
                    className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition hover:shadow-sm ${
                      videoUrl === video.url ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt="" className="w-20 aspect-video rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-20 aspect-video rounded bg-gray-100 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 line-clamp-1">{video.title}</p>
                      <p className="text-[11px] text-gray-500">{video.channelName} · {fmt(video.viewCount)} views</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP: TRANSCRIPT ── */}
      {step === 'transcript' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Transcript</h3>
              <span className="text-[11px] text-gray-400">{transcript.length.toLocaleString()} chars</span>
            </div>
            <div className="max-h-80 overflow-y-auto rounded-lg bg-gray-50 p-4 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
              {transcript}
            </div>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
          >
            Analyze This Video
          </button>
        </div>
      )}

      {/* ── STEP: ANALYSIS ── */}
      {step === 'analyze' && (
        <div className="space-y-4">
          <div className="flex gap-4">
            {/* Scorecard sidebar */}
            {scores.length > 0 && (
              <div className="w-72 flex-shrink-0 space-y-2">
                {/* Overall score */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Overall Score</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {(scores.reduce((sum, s) => sum + s.score, 0) / scores.length).toFixed(1)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">out of 10</p>
                </div>

                {/* Individual scores */}
                {scores.map(item => {
                  const isOpen = expandedScore === item.label
                  const color =
                    item.score >= 8 ? 'text-green-600 bg-green-50 border-green-200' :
                    item.score >= 5 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                    'text-red-600 bg-red-50 border-red-200'
                  const barColor =
                    item.score >= 8 ? 'bg-green-500' :
                    item.score >= 5 ? 'bg-yellow-500' :
                    'bg-red-500'

                  return (
                    <div key={item.label} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <button
                        onClick={() => setExpandedScore(isOpen ? null : item.label)}
                        className="w-full p-3 text-left hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-gray-900">{item.label}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${color}`}>
                            {item.score}/10
                          </span>
                        </div>
                        {/* Score bar */}
                        <div className="h-1.5 w-full rounded-full bg-gray-100">
                          <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${item.score * 10}%` }} />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-1">{item.summary}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-red-500 font-medium">
                            {item.improvements.length} suggestions
                          </span>
                          <svg className={`h-3 w-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </div>
                      </button>

                      {/* Expanded improvements dropdown */}
                      {isOpen && (
                        <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">How to improve</p>
                          {item.improvements.map((imp, i) => (
                            <div key={i} className="flex gap-2 items-start">
                              <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[9px] font-bold text-red-600 flex-shrink-0">
                                {i + 1}
                              </span>
                              <p className="text-[11px] text-gray-700 leading-snug">{imp}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Main analysis content */}
            <div className="flex-1 min-w-0">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Video Analysis</h3>
                <div className="prose prose-sm max-w-none text-gray-700 max-h-[600px] overflow-y-auto whitespace-pre-wrap">
                  {analysis}
                </div>
              </div>
            </div>
          </div>

          {/* Script generation section */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Now, what&apos;s YOUR video about?</h3>
            <p className="text-xs text-gray-500 mb-3">
              Use the insights above to create your own version. What topic do you want to cover?
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={myTopic}
                onChange={e => setMyTopic(e.target.value)}
                placeholder="e.g. How to dispute collections in 2026"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                onKeyDown={e => e.key === 'Enter' && generateScript()}
              />
              <button
                onClick={generateScript}
                disabled={!myTopic.trim() || loading}
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                Generate Script
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: SCRIPT ── */}
      {step === 'script' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Your Script: {myTopic}</h3>
              <button
                onClick={() => navigator.clipboard.writeText(script)}
                className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition"
              >
                Copy
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 max-h-[500px] overflow-y-auto whitespace-pre-wrap">
              {script}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Slides:</label>
              <select
                value={slideCount}
                onChange={e => setSlideCount(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                {[5, 6, 8, 10, 12].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button
              onClick={generatePresentation}
              disabled={loading}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
            >
              Generate Slides
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: PRESENTATION ── */}
      {step === 'presentation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Slide Presentation</h3>
            <div className="flex gap-2">
              <button
                onClick={downloadPresentation}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition"
              >
                Download HTML
              </button>
              <button
                onClick={() => {
                  const w = window.open('', '_blank')
                  if (w) { w.document.write(presentation); w.document.close() }
                }}
                className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Open Fullscreen
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-900">
            <iframe
              ref={presentationRef}
              srcDoc={presentation}
              className="w-full h-[500px] border-0"
              title="Presentation Preview"
              sandbox="allow-scripts"
            />
          </div>

          {/* Slide adjustment chat */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Adjust Slides</h4>

            {slideChatHistory.length > 0 && (
              <div ref={slideChatRef} className="max-h-40 overflow-y-auto space-y-2 mb-3">
                {slideChatHistory.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-xs ${
                      m.role === 'user'
                        ? 'bg-red-50 text-red-800 ml-8'
                        : 'bg-gray-50 text-gray-700 mr-8'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div className="text-xs text-gray-400 animate-pulse">Updating slides…</div>
                )}
              </div>
            )}

            <form
              onSubmit={e => { e.preventDefault(); adjustSlides(slideChat) }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={slideChat}
                onChange={e => setSlideChat(e.target.value)}
                placeholder="e.g. Add a slide about credit disputes, change background to blue, make text bigger..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !slideChat.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                Update
              </button>
            </form>
          </div>

          <div className="flex gap-3">
            <button
              onClick={generateTitles}
              disabled={loading}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
            >
              Next: Generate Titles
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: TITLES ── */}
      {step === 'titles' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Title Ideas</h3>
              <div className="flex gap-2">
                <button
                  onClick={generateTitles}
                  disabled={loading}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition"
                >
                  Regenerate
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(titlesList.join('\n'))}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition"
                >
                  Copy All
                </button>
              </div>
            </div>
            {titlesList.length > 0 ? (
              <div className="space-y-2">
                {titlesList.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-gray-100 transition group"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600 flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-800 flex-1">{t}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(t)}
                      className="text-[10px] text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400 mb-3">No titles generated yet.</p>
                <button
                  onClick={generateTitles}
                  disabled={loading}
                  className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {loading ? 'Generating…' : 'Generate Titles'}
                </button>
              </div>
            )}
          </div>
          {titlesList.length > 0 && presentation && (
            <button
              onClick={() => setStep('finish')}
              className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition"
            >
              Next: Finish &amp; Save
            </button>
          )}
          {!presentation && (
            <button
              onClick={generatePresentation}
              disabled={loading}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
            >
              Generate Slides First
            </button>
          )}
        </div>
      )}

      {/* ── STEP: FINISH ── */}
      {step === 'finish' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <div className="mb-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Content Package Ready</h3>
              <p className="text-sm text-gray-500 mt-1">{myTopic}</p>
            </div>

            <div className="flex items-center justify-center gap-3">
              {projectSaved ? (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
                  Saved to Content Library!
                </div>
              ) : (
                <button
                  onClick={handleSaveProject}
                  className="rounded-lg bg-red-600 px-8 py-3 text-sm font-medium text-white hover:bg-red-700 transition"
                >
                  Save to Content Library
                </button>
              )}
            </div>
          </div>

          {/* Add to Calendar / Kanban */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Add to Calendar / Board</h4>
            {addedToCalendar ? (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
                Added to your board!
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[140px]">
                  <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                    Stage
                  </label>
                  <select
                    value={calendarStatus}
                    onChange={e => setCalendarStatus(e.target.value as CalendarStatus)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="idea">Idea</option>
                    <option value="scripting">Scripting</option>
                    <option value="filming">Filming</option>
                    <option value="editing">Editing</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div className="min-w-[160px]">
                  <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                    Date
                  </label>
                  <input
                    type="date"
                    value={calendarDate}
                    onChange={e => setCalendarDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <button
                  onClick={() => {
                    onAddToCalendar({
                      title: myTopic,
                      date: calendarDate || new Date().toISOString().split('T')[0],
                      status: calendarStatus,
                      notes: `Source: ${videoTitle}`,
                      sourceUrl: videoUrl,
                    })
                    setAddedToCalendar(true)
                  }}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
                >
                  Add to Board
                </button>
              </div>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Script summary */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Script</h4>
              <p className="text-xs text-gray-600 line-clamp-6 whitespace-pre-wrap mb-3">{script.slice(0, 400)}...</p>
              <button
                onClick={() => navigator.clipboard.writeText(script)}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Copy Full Script
              </button>
            </div>

            {/* Slides summary */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Slides</h4>
              <div className="rounded-lg overflow-hidden bg-gray-900 mb-3">
                <iframe
                  srcDoc={presentation}
                  className="w-full h-32 border-0 pointer-events-none"
                  title="Slides preview"
                  sandbox="allow-scripts"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={downloadPresentation}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Download
                </button>
                <button
                  onClick={() => {
                    const w = window.open('', '_blank')
                    if (w) { w.document.write(presentation); w.document.close() }
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Fullscreen
                </button>
              </div>
            </div>

            {/* Titles summary */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Titles</h4>
              <ul className="space-y-1 mb-3">
                {titlesList.slice(0, 5).map((t, i) => (
                  <li key={i} className="text-xs text-gray-600 truncate">{i + 1}. {t}</li>
                ))}
                {titlesList.length > 5 && (
                  <li className="text-[10px] text-gray-400">+{titlesList.length - 5} more</li>
                )}
              </ul>
              <button
                onClick={() => navigator.clipboard.writeText(titlesList.join('\n'))}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Copy All Titles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
