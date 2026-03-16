export interface VideoResult {
  title: string | null
  url: string | null
  viewCount: number | null
  uploadDate: string | null
  thumbnailUrl: string | null
  channelName: string | null
  description: string | null
  subscriberCount: number | null
  type?: 'video' | 'shorts' | null
}

export interface SavedVideo extends VideoResult {
  savedAt: string
}

export type CalendarStatus = 'idea' | 'scripting' | 'filming' | 'editing' | 'scheduled' | 'published'

export interface CalendarEntry {
  id: string
  title: string
  date: string
  status: CalendarStatus
  notes: string
  sourceUrl?: string
}

export interface ScoreItem {
  label: string
  score: number
  summary: string
  improvements: string[]
}

export interface ComparisonDimension {
  label: string
  referenceScore: number
  myScore: number
  delta: number
  summary: string
  improvements: string[]
}

export interface ComparisonResult {
  dimensions: ComparisonDimension[]
  overallSummary: string
  comparedAt: string
}

export interface ContentProject {
  id: string
  title: string
  sourceVideoTitle: string
  sourceVideoUrl: string
  script: string
  presentation: string
  titles: string[]
  savedAt: string
  sourceTranscript?: string
  sourceScores?: ScoreItem[]
  myVideoUrl?: string
  myVideoTitle?: string
  myTranscript?: string
  myScores?: ScoreItem[]
  comparisonResult?: ComparisonResult
}
