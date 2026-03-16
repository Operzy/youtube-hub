'use client'

import { useState } from 'react'
import { ContentProject, ScoreItem, ComparisonResult } from '@/types/youtube'
import { authFetch } from '@/lib/api-client'

interface Props {
  project: ContentProject
  onUpdate: (id: string, fields: Partial<ContentProject>) => Promise<void>
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right text-[11px] font-bold" style={{ color }}>{score}/10</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${score * 10}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-[10px] font-bold text-green-600">+{delta}</span>
  if (delta < 0) return <span className="text-[10px] font-bold text-red-600">{delta}</span>
  return <span className="text-[10px] font-bold text-gray-400">=</span>
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

  async function runComparison() {
    if (!myUrl.trim()) return
    setLoading(true)
    setError('')
    setStep('comparing')

    try {
      // Step 1: Fetch transcript for user's video
      const transcriptRes = await authFetch('/api/transcript', {
        method: 'POST',
        body: JSON.stringify({ videoUrl: myUrl }),
      })
      const transcriptData = await transcriptRes.json()
      if (!transcriptRes.ok) throw new Error(transcriptData.error || 'Failed to fetch transcript')

      const myTranscript = transcriptData.transcript as string
      const fetchedTitle = transcriptData.title || ''
      setMyTitle(fetchedTitle)

      // Step 2: Score user's video + run comparison in parallel
      const sourceTranscript = project.sourceTranscript || ''
      if (!sourceTranscript) {
        throw new Error('Source transcript not available. Re-save this project from Creator Hub first.')
      }

      const [myScoresRes, comparisonRes] = await Promise.all([
        // Score user's video
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
        // Run side-by-side comparison
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
        myVideoUrl: myUrl,
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
  }

  // ── Input state ──
  if (step === 'input') {
    return (
      <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
        <h4 className="text-xs font-semibold text-gray-900 mb-2">Compare Your Video</h4>
        <p className="text-[11px] text-gray-500 mb-3">
          Paste the YouTube URL of your finished video to compare it against the reference.
        </p>
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
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
      </div>
    )
  }

  // ── Comparing state ──
  if (step === 'comparing') {
    return (
      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
          <div>
            <p className="text-sm font-medium text-blue-900">Comparing videos...</p>
            <p className="text-[11px] text-blue-600">Fetching transcript, scoring, and analyzing differences</p>
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
      {/* Header with titles */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Video Comparison</h4>
          <button
            onClick={resetComparison}
            className="text-[10px] text-red-500 hover:text-red-700 font-medium"
          >
            New Comparison
          </button>
        </div>

        {/* Overall scores side by side */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Reference</p>
            <p className="text-xs font-medium text-gray-700 truncate mb-2">{project.sourceVideoTitle}</p>
            <p className="text-2xl font-bold text-gray-900">{refAvg.toFixed(1)}</p>
            <p className="text-[10px] text-gray-400">avg score</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Your Video</p>
            <p className="text-xs font-medium text-gray-700 truncate mb-2">{myTitle || 'Your version'}</p>
            <p className="text-2xl font-bold text-gray-900">{myAvg.toFixed(1)}</p>
            <p className="text-[10px] text-gray-400">
              avg score{' '}
              <span className={avgDelta >= 0 ? 'text-green-600' : 'text-red-600'}>
                ({avgDelta >= 0 ? '+' : ''}{avgDelta.toFixed(1)})
              </span>
            </p>
          </div>
        </div>

        {/* Dimension-by-dimension comparison */}
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
                  <ScoreBar label="ref" score={dim.referenceScore} color={dim.referenceScore >= 7 ? '#22c55e' : dim.referenceScore >= 4 ? '#eab308' : '#ef4444'} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Yours</p>
                  <ScoreBar label="my" score={dim.myScore} color={dim.myScore >= 7 ? '#22c55e' : dim.myScore >= 4 ? '#eab308' : '#ef4444'} />
                </div>
              </div>

              <p className="text-[11px] text-gray-600 mb-1">{dim.summary}</p>

              {dim.improvements.length > 0 && (
                <div className="mt-2 space-y-1">
                  {dim.improvements.map((imp, i) => (
                    <div key={i} className="flex gap-1.5 items-start">
                      <span className="mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-100 text-[8px] font-bold text-red-600 flex-shrink-0">
                        !
                      </span>
                      <p className="text-[11px] text-gray-500">{imp}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Overall summary */}
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-[10px] font-semibold text-blue-800 uppercase tracking-wide mb-1">Summary</p>
          <p className="text-xs text-blue-900 leading-relaxed">{result.overallSummary}</p>
        </div>

        {result.comparedAt && (
          <p className="text-[10px] text-gray-400 mt-2">
            Compared {new Date(result.comparedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
