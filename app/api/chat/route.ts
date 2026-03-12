import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages, systemPrompt } = await req.json()

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: 'messages are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 16000,
          system: systemPrompt,
          messages: messages as Anthropic.MessageParam[],
        })

        stream.on('text', (text) => {
          controller.enqueue(encoder.encode(text))
        })

        await stream.finalMessage()
        controller.close()
      } catch (err) {
        const msg = err instanceof Anthropic.APIError
          ? `Anthropic error ${err.status}: ${err.message}`
          : 'Chat failed'
        controller.enqueue(encoder.encode(`\n\n_Error: ${msg}_`))
        controller.close()
      }
    },
    cancel() {
      // stream aborted by client
    },
  })

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
