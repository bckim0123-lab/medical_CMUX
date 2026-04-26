import OpenAI from 'openai';

// Centralized OpenAI client. Acts as a fallback when Gemini key is missing
// or Gemini calls fail. Accepts the canonical name plus common aliases.

const OPENAI_KEY_ALIASES = [
  'OPENAI_API_KEY',
  'OPENAI_KEY',
  'OPENAI_TOKEN',
  'OPEN_AI_API_KEY',
];

export function resolveOpenAIKey(): string | undefined {
  for (const name of OPENAI_KEY_ALIASES) {
    const v = process.env[name];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

export function hasOpenAIKey(): boolean {
  return Boolean(resolveOpenAIKey());
}

export function getOpenAI() {
  const apiKey = resolveOpenAIKey();
  if (!apiKey) {
    throw new Error(
      `OpenAI API key not set. Tried: ${OPENAI_KEY_ALIASES.join(', ')}`,
    );
  }
  return new OpenAI({ apiKey });
}

// gpt-4o-mini ≈ gemini-2.5-flash 속도/비용. 시연 충분.
export const OPENAI_MODEL_FAST = 'gpt-4o-mini';
export const OPENAI_MODEL_PRO = 'gpt-4o';
