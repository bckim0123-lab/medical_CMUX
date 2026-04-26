// Multi-provider text generation with automatic swap.
// Order: OpenAI (preferred) → Gemini fallback → throw.
// 우선순위는 PROVIDER_ORDER 로 조절 가능.

import { getGemini, hasGeminiKey, MODEL_FAST as GEMINI_FAST } from './gemini';
import { getOpenAI, hasOpenAIKey, OPENAI_MODEL_FAST } from './openai';

const PROVIDER_ORDER: Array<'openai' | 'gemini'> = ['openai', 'gemini'];

export type GenerateOptions = {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  /** "json" 이면 JSON 응답 강제 (Gemini responseMimeType / OpenAI response_format) */
  responseFormat?: 'text' | 'json';
};

export type GenerateResult = {
  text: string;
  provider: 'gemini' | 'openai';
};

export function availableProviders(): Array<'openai' | 'gemini'> {
  return PROVIDER_ORDER.filter((p) => (p === 'openai' ? hasOpenAIKey() : hasGeminiKey()));
}

export function hasAnyLlmKey(): boolean {
  return hasOpenAIKey() || hasGeminiKey();
}

async function callOpenAI(opts: GenerateOptions): Promise<string> {
  const oa = getOpenAI();
  const res = await oa.chat.completions.create({
    model: OPENAI_MODEL_FAST,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 2048,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.prompt },
    ],
    ...(opts.responseFormat === 'json'
      ? { response_format: { type: 'json_object' as const } }
      : {}),
  });
  return res.choices?.[0]?.message?.content ?? '';
}

async function callGemini(opts: GenerateOptions): Promise<string> {
  const ai = getGemini();
  const model = ai.getGenerativeModel({
    model: GEMINI_FAST,
    systemInstruction: opts.system,
    generationConfig: {
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxTokens ?? 2048,
      ...(opts.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
    },
  });
  const res = await model.generateContent(opts.prompt);
  return res.response.text();
}

export async function generateText(opts: GenerateOptions): Promise<GenerateResult> {
  const errors: string[] = [];
  for (const p of PROVIDER_ORDER) {
    const has = p === 'openai' ? hasOpenAIKey() : hasGeminiKey();
    if (!has) continue;
    try {
      const text = p === 'openai' ? await callOpenAI(opts) : await callGemini(opts);
      return { text, provider: p };
    } catch (err) {
      errors.push(`${p}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(
    `No LLM provider succeeded. Tried: ${errors.length > 0 ? errors.join(' | ') : 'none configured'}`,
  );
}
