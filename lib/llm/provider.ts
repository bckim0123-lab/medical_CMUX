// Single-provider text generation: OpenAI 만 사용.
// 과거에 Gemini fallback 이 있었으나 Gemini 키 잦은 만료/leak detection 으로
// OpenAI 단일로 고정. Gemini 코드는 보존만 하고 호출하지 않음.

import { getOpenAI, hasOpenAIKey, OPENAI_MODEL_FAST } from './openai';

const PROVIDER_ORDER: Array<'openai'> = ['openai'];

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
  provider: 'openai';
};

export function availableProviders(): Array<'openai'> {
  return PROVIDER_ORDER.filter(() => hasOpenAIKey());
}

export function hasAnyLlmKey(): boolean {
  return hasOpenAIKey();
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

export async function generateText(opts: GenerateOptions): Promise<GenerateResult> {
  if (!hasOpenAIKey()) {
    throw new Error('OPENAI_API_KEY not set');
  }
  const text = await callOpenAI(opts);
  return { text, provider: 'openai' };
}
