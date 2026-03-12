const requests = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 20 // per window per user

export function rateLimit(userId: string): { ok: boolean; remaining: number } {
  const now = Date.now()
  const entry = requests.get(userId)

  if (!entry || now > entry.resetAt) {
    requests.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true, remaining: MAX_REQUESTS - 1 }
  }

  if (entry.count >= MAX_REQUESTS) {
    return { ok: false, remaining: 0 }
  }

  entry.count++
  return { ok: true, remaining: MAX_REQUESTS - entry.count }
}

export function rateLimitResponse() {
  return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  })
}
