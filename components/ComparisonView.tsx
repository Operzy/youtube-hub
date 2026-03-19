'use client'

import { useState, useRef } from 'react'
import { ContentProject, ScoreItem, ComparisonResult } from '@/types/youtube'
import { authFetch } from '@/lib/api-client'

interface Props {
  project: ContentProject
  onUpdate: (id: string, fields: Partial<ContentProject>) => Promise<void>
}

type InputMode = 'youtube' | 'mp4'

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right text-[11px] font-bold" style={{ color }}>{score}/10</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full" style={{ width: `${score * 10}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-[10px] font-bold text-green-600">+{delta}</span>
  if (delta < 0) return <span className="text-[10px] font-bold text-red-600">{delta}</span>
  return <span className="text-[10px] font-bold text-gray-400">=</span>
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function ComparisonView({ project, onUpdate }: Props) {
  const [myUrl, setMyUrl] = useState(project.myVideoUrl || '')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'input' | 'comparing' | 'done'>(
    project.comparisonResult ? 'done' : 'input'
  )
  const [error, setError] = useState('')
  const [result, setResult] = useState<ComparisonResult | null>(project.comparisonResult || null)
  const [myTitle, setMyTitle] = useState(project.myVideoTitle || '')
  const [inputMode, setInputMode] = useState<InputMode>('youtube')
  const [mp4File, setMp4File] = useState<File | null>(null)
  const [transcript, setTranscript] = useState('')
  const [useProjectScript, setUseProjectScript] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mp4VideoUrl, setMp4VideoUrl] = useState<string | null>(null)

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.mov') || file.name.endsWith('.webm'))) {
      setMp4File(file)
      setMyTitle(file.name.replace(/\.[^/.]+$/, ''))
      if (mp4VideoUrl) URL.revokeObjectURL(mp4VideoUrl)
      setMp4VideoUrl(URL.createObjectURL(file))
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setMp4File(file)
      setMyTitle(file.name.replace(/\.[^/.]+$/, ''))
      if (mp4VideoUrl) URL.revokeObjectURL(mp4VideoUrl)
      setMp4VideoUrl(URL.createObjectURL(file))
    }
  }

  function handleUseProjectScript() {
    setUseProjectScript(true)
    setTranscript(project.script || '')
  }

  async function runComparison() {
    setLoading(true)
    setError('')
    setStep('comparing')

    try {
      let myTranscript = ''
      let fetchedTitle = myTitle

      if (inputMode === 'youtube') {
        // YouTube URL flow — extract transcript via Apify
        if (!myUrl.trim()) throw new Error('Please enter a YouTube URL')

        const transcriptRes = await authFetch('/api/transcript', {
          method: 'POST',
          body: JSON.stringify({ videoUrl: myUrl }),
        })
        const transcriptData = await transcriptRes.json()
        if (!transcriptRes.ok) throw new Error(transcriptData.error || 'Failed to fetch transcript')

        myTranscript = transcriptData.transcript as string
        fetchedTitle = transcriptData.title || myTitle
        setMyTitle(fetchedTitle)
      } else {
        // MP4 flow — use provided transcript
        if (!mp4File) throw new Error('Please drop or select a video file')
        if (!transcript.trim() && !useProjectScript) {
          throw new Error('Please provide a transcript for your video. You can paste it or use your Creator Hub script.')
        }
        myTranscript = transcript.trim()
        fetchedTitle = myTitle || mp4File.name
      }

      // Validate source transcript
      const sourceTranscript = project.sourceTranscript || ''
      if (!sourceTranscript) {
        throw new Error('Source transcript not available. Re-save this project from Creator Hub first.')
      }

      // Score user's video + run comparison in parallel
      const [myScoresRes, comparisonRes] = await Promise.all([
        authFetch('/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            promptType: 'score',
            messages: [{
              role: 'user',
              content: `Score this YouTube video transcript on each element. Return a JSON array with exactly this structure:
[
  {"label": "Hook", "score": <1-10>, "summary": "<one sentence>", "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"]},
  {"label": "Structure", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "Storytelling", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "CTAs", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "Pacing", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "Value Density", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "Engagement", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]},
  {"label": "SEO / Discoverability", "score": <1-10>, "summary": "...", "improvements": ["...", "...", "..."]}
]

Video: "${fetchedTitle}"

Transcript:
${myTranscript.slice(0, 6000)}`
            }],
          }),
        }),
        authFetch('/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            promptType: 'compare',
            messages: [{
              role: 'user',
              content: `Compare these two YouTube video transcripts. The REFERENCE video is the original that was studied. MY VIDEO is the user's version inspired by it.

For each dimension, score BOTH videos 1-10 and explain the difference. Return ONLY this JSON:
{
  "dimensions": [
    {"label": "Hook", "referenceScore": <1-10>, "myScore": <1-10>, "delta": <myScore - referenceScore>, "summary": "<what's different>", "improvements": ["<specific way to close the gap>"]},
    {"label": "Structure", "referenceScore": <1-10>, "myScore": <1-10>, "delta": <number>, "summary": "...", "improvements": ["..."]},
    {"label": "Storytelling", "referenceScore": <1-10>, "myScore": <1-10>, "delta": <number>, "summary": "...", "improvements": ["..."]},
    {"label": "CTAs", "referenceScore": <1-10>, "myScore": <1-10>, "delta": <number>, "summary": "...", "improvements": ["..."]},
    {"label": "Pacing / Energy", "referenceScore": <1-10>, "myScore": <1-10>, "delta": <number>, "summary": "...", "improvements": ["..."]},
    {"label": "Tonality", "referenceScore": <1-10>, "myScore": <1-10>, "delta": <number>, "summary": "...", "improvements": ["..."]},
    {"label": "Value Density", "referenceScore": <1-10>, "myScore": <1-10>, "delta": <number>, "summary": "...", "improvements": ["..."]},
    {"label": "Engagement", "referenceScore": <1-10>, "myScore": <1-10>, "delta": <number>, "summary": "...", "improvements": ["..."]}
  ],
  "overallSummary": "<2-3 sentences on overall comparison and top priority improvements>"
}

REFERENCE VIDEO: "${project.sourceVideoTitle}"
Transcript:
${sourceTranscript.slice(0, 5000)}

MY VIDEO: "${fetchedTitle}"
Transcript:
${myTranscript.slice(0, 5000)}`
            }],
          }),
        }),
      ])

      if (!myScoresRes.ok) throw new Error('Failed to score your video')
      if (!comparisonRes.ok) throw new Error('Failed to run comparison')

      // Parse my scores
      const myScoresText = await myScoresRes.text()
      let myScores: ScoreItem[] = []
      try {
        let jsonStr = myScoresText.trim()
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
        if (jsonMatch) jsonStr = jsonMatch[0]
        myScores = JSON.parse(jsonStr)
      } catch {
        // scores parsing failed, continue with comparison
      }

      // Parse comparison result
      const comparisonText = await comparisonRes.text()
      let comparison: ComparisonResult
      try {
        let jsonStr = comparisonText.trim()
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (jsonMatch) jsonStr = jsonMatch[0]
        const parsed = JSON.parse(jsonStr)
        comparison = {
          ...parsed,
          comparedAt: new Date().toISOString(),
        }
      } catch {
        throw new Error('Failed to parse comparison results')
      }

      setResult(comparison)
      setStep('done')

      // Save to database
      await onUpdate(project.id, {
        myVideoUrl: inputMode === 'youtube' ? myUrl : `mp4:${mp4File?.name || 'uploaded-video'}`,
        myVideoTitle: fetchedTitle,
        myTranscript,
        myScores,
        comparisonResult: comparison,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed')
      setStep('input')
    } finally {
      setLoading(false)
    }
  }

  function resetComparison() {
    setResult(null)
    setStep('input')
    setMyUrl('')
    setMyTitle('')
    setError('')
    setMp4File(null)
    setTranscript('')
    setUseProjectScript(false)
    if (mp4VideoUrl) URL.revokeObjectURL(mp4VideoUrl)
    setMp4VideoUrl(null)
  }

  // ── Input state ──
  if (step === 'input') {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Compare Your Video</h4>
        <p className="text-[11px] text-gray-500 mb-4">
          Benchmark your video against the reference: <span className="font-medium text-gray-700">{project.sourceVideoTitle}</span>
        </p>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        {/* Input Mode Toggle */}
        <div className="flex rounded-lg border border-gray-200 p-0.5 mb-4 w-fit">
          <button
            onClick={() => setInputMode('youtube')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              inputMode === 'youtube' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            YouTube URL
          </button>
          <button
            onClick={() => setInputMode('mp4')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              inputMode === 'mp4' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Upload MP4
          </button>
        </div>

        {/* YouTube URL Input */}
        {inputMode === 'youtube' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={myUrl}
                onChange={e => setMyUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button
                onClick={runComparison}
                disabled={!myUrl.trim() || loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                Compare
              </button>
            </div>
            <p className="text-[10px] text-gray-400">Paste the URL of your published YouTube video</p>
          </div>
        )}

        {/* MP4 Upload Input */}
        {inputMode === 'mp4' && (
          <div className="space-y-4">
            {/* Drop Zone */}
            <div
              className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
                dragOver
                  ? 'border-red-400 bg-red-50 scale-[1.01]'
                  : mp4File
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.webm,.avi"
                onChange={handleFileSelect}
                className="hidden"
              />

              {mp4File ? (
                <div className="space-y-2">
                  {mp4VideoUrl && (
                    <video
                      src={mp4VideoUrl}
                      className="mx-auto rounded-lg max-h-40 shadow-sm"
                      controls
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                  <div className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-green-700">{mp4File.name}</span>
                    <span className="text-xs text-gray-400">({formatFileSize(mp4File.size)})</span>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setMp4File(null)
                      if (mp4VideoUrl) URL.revokeObjectURL(mp4VideoUrl)
                      setMp4VideoUrl(null)
                    }}
                    className="text-[10px] text-gray-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <svg className="h-10 w-10 text-gray-300 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm font-medium text-gray-600">Drop your MP4 here</p>
                  <p className="text-xs text-gray-400 mt-1">or click to browse &middot; MP4, MOV, WebM</p>
                </div>
              )}
            </div>

            {/* Video Title */}
            {mp4File && (
              <div>
                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Video Title</label>
                <input
                  type="text"
                  value={myTitle}
                  onChange={e => setMyTitle(e.target.value)}
                  placeholder="My video title"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
            )}

            {/* Transcript Input */}
            {mp4File && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Transcript / Script</label>
                  {project.script && !useProjectScript && (
                    <button
                      onClick={handleUseProjectScript}
                      className="text-[10px] text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Use Creator Hub Script
                    </button>
                  )}
                  {useProjectScript && (
                    <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Using project script
                    </span>
                  )}
                </div>
                <textarea
                  value={transcript}
                  onChange={e => { setTranscript(e.target.value); setUseProjectScript(false) }}
                  placeholder="Paste your video transcript or script here... Or click 'Use Creator Hub Script' above to auto-fill from your project."
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  This is what gets compared against the reference video. Paste what you actually said in the video for the most accurate comparison.
                </p>
              </div>
            )}

            {/* Compare Button */}
            {mp4File && transcript.trim() && (
              <button
                onClick={runComparison}
                disabled={loading}
                className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Benchmark Against Reference
              </button>
            )}
          </div>
        )}

        {/* Reference Video Info */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Benchmarking Against</p>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200">
              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-700 truncate">{project.sourceVideoTitle}</p>
              {project.sourceScores && (
                <p className="text-[10px] text-gray-400">
                  Avg score: {(project.sourceScores.reduce((s, sc) => s + sc.score, 0) / project.sourceScores.length).toFixed(1)}/10
                </p>
              )}
            </div>
            {project.sourceVideoUrl && (
              <a href={project.sourceVideoUrl} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-red-500 hover:text-red-700 font-medium flex-shrink-0">
                Watch ↗
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Comparing state ──
  if (step === 'comparing') {
    return (
      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-red-600 border-t-transparent" />
          <div>
            <p className="text-sm font-medium text-blue-900">Benchmarking your video...</p>
            <p className="text-[11px] text-blue-600">
              {inputMode === 'youtube' ? 'Fetching transcript, scoring, and analyzing differences' : 'Scoring and comparing against reference video'}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[10px] text-blue-700">Analyzing hook, structure, storytelling</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
            <span className="text-[10px] text-blue-700">Scoring pacing, engagement, value density</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.6s' }} />
            <span className="text-[10px] text-blue-700">Comparing against reference benchmarks</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Results state ──
  if (!result) return null

  const refAvg = result.dimensions.reduce((s, d) => s + d.referenceScore, 0) / result.dimensions.length
  const myAvg = result.dimensions.reduce((s, d) => s + d.myScore, 0) / result.dimensions.length
  const avgDelta = myAvg - refAvg

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Video Comparison</h4>
          <button onClick={resetComparison} className="text-[10px] text-red-500 hover:text-red-700 font-medium">
            New Comparison
          </button>
        </div>

        {/* Overall scores */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Reference</p>
            <p className="text-xs font-medium text-gray-700 truncate mb-2">{project.sourceVideoTitle}</p>
            <p className="text-2xl font-bold text-gray-900">{refAvg.toFixed(1)}</p>
            <p className="text-[10px] text-gray-400">avg score</p>
          </div>
          <div className={`rounded-lg border p-3 text-center ${
            avgDelta >= 0 ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'
          }`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Your Video</p>
            <p className="text-xs font-medium text-gray-700 truncate mb-2">{myTitle || 'Your version'}</p>
            <p className="text-2xl font-bold text-gray-900">{myAvg.toFixed(1)}</p>
            <p className="text-[10px] text-gray-400">
              avg score{' '}
              <span className={`font-bold ${avgDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ({avgDelta >= 0 ? '+' : ''}{avgDelta.toFixed(1)})
              </span>
            </p>
          </div>
        </div>

        {/* Dimension comparisons */}
        <div className="space-y-3">
          {result.dimensions.map(dim => (
            <div key={dim.label} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-900">{dim.label}</span>
                <DeltaBadge delta={dim.delta} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Reference</p>
                  <ScoreBar score={dim.referenceScore} color={dim.referenceScore >= 7 ? '#22c55e' : dim.referenceScore >= 4 ? '#eab308' : '#ef4444'} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Yours</p>
                  <ScoreBar score={dim.myScore} color={dim.myScore >= 7 ? '#22c55e' : dim.myScore >= 4 ? '#eab308' : '#ef4444'} />
                </div>
              </div>

              <p className="text-[11px] text-gray-600 mb-1">{dim.summary}</p>

              {dim.improvements.length > 0 && (
                <div className="mt-2 space-y-1">
                  {dim.improvements.map((imp, i) => (
                    <div key={i} className="flex gap-1.5 items-start">
                      <span className="mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-100 text-[8px] font-bold text-red-600 flex-shrink-0">!</span>
                      <p className="text-[11px] text-gray-500">{imp}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-[10px] font-semibold text-blue-800 uppercase tracking-wide mb-1">Summary</p>
          <p className="text-xs text-blue-900 leading-relaxed">{result.overallSummary}</p>
        </div>

        {result.comparedAt && (
          <p className="text-[10px] text-gray-400 mt-2">Compared {new Date(result.comparedAt).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  )
}
