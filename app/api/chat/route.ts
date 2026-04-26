import { chat, type ChatMessage } from '@/lib/agents/chatbot';
import { DEFAULT_SESSION_ID, getOrchestrationState } from '@/lib/state-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { sessionId?: string; messages?: ChatMessage[] };
  try {
    body = (await req.json()) as { sessionId?: string; messages?: ChatMessage[] };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const sessionId = body.sessionId ?? DEFAULT_SESSION_ID;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const state = getOrchestrationState(sessionId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const evt of chat(messages, state)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
