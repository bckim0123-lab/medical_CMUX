import { GoogleGenerativeAI } from '@google/generative-ai';

// Centralized Gemini client. Switching models or providers happens here.
//
// Env var resolution accepts the canonical name plus common aliases so that
// Vercel-side variables set under any of these names "just work":
//   GEMINI_API_KEY (canonical) | GOOGLE_GEMINI_API_KEY | GOOGLE_API_KEY
//   GEMINI_KEY                 | GENAI_API_KEY

const GEMINI_KEY_ALIASES = [
  'GEMINI_API_KEY',
  'GOOGLE_GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_KEY',
  'GENAI_API_KEY',
];

function resolveGeminiKey(): string | undefined {
  for (const name of GEMINI_KEY_ALIASES) {
    const v = process.env[name];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

export function getGemini() {
  const apiKey = resolveGeminiKey();
  if (!apiKey) {
    throw new Error(
      `Gemini API key not set. Tried: ${GEMINI_KEY_ALIASES.join(', ')}`,
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

export function hasGeminiKey(): boolean {
  return Boolean(resolveGeminiKey());
}

export const MODEL_FAST = 'gemini-2.5-flash';
export const MODEL_PRO = 'gemini-2.5-pro';
