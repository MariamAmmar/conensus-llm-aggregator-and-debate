import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/chat
 *
 * Stub endpoint. Connect providers in providers/ and wire up the router
 * to enable real AI responses.
 *
 * Expected request body:
 * {
 *   prompt: string;
 *   mode: ModelMode;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, mode } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'prompt is required and must be a string' },
        { status: 400 },
      );
    }

    if (!mode || typeof mode !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'mode is required and must be a string' },
        { status: 400 },
      );
    }

    // TODO: Connect providers and router here
    // import { route } from '@/router';
    // import { providers } from '@/providers';
    // const decision = route(prompt, mode);
    // const response = await providers[decision.selectedModel].complete(prompt);

    return NextResponse.json(
      {
        error: 'Not Implemented',
        message: 'Provider connections not yet configured. Enable NEXT_PUBLIC_MOCK_MODE=true to use mock data, or connect API keys in .env and implement providers in /providers.',
        hint: 'Set NEXT_PUBLIC_MOCK_MODE=true in your .env file to use the built-in mock responses.',
      },
      { status: 501 },
    );
  } catch (err) {
    console.error('[/api/chat] Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
