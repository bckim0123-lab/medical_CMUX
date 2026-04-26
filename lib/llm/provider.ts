// Multi-provider text generation with automatic swap.
// Order: Gemini (preferred) → OpenAI fallback → throw.
//
// 사용법:
//   const text = await generateText({
//     system: '...',
//     prompt: '...',
//     temperature: 0.3,
//     maxTokens: 1024,
//   });

import { getGemini, hasGeminiKey, MODEL_FAST as GEMINI_FAST } from './gemini';
import { getOpenAI, hasOpenAIKey, OPENAI_MODEL_FAST } from './openai';

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

export function availableProviders(): Array<'gemini' | 'openai'> {
  const out: Array<'gemini' | 'openai'> = [];
  if (hasGeminiKey()) out.push('gemini');
  if (hasOpenAIKey()) out.push('openai');
  return out;
}

export function hasAnyLlmKey(): boolean {
  return hasGeminiKey() || hasOpenAIKey();
}

export async function generateText(opts: GenerateOptions): Promise<GenerateResult> {
  const errors: string[] = [];

  // 1) Gemini 시도
  if (hasGeminiKey()) {
    try {
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
      const text = res.response.text();
      return { text, provider: 'gemini' };
    } catch (err) {
      errors.push(`gemini: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2) OpenAI 시도
  if (hasOpenAIKey()) {
    try {
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
      const text = res.choices?.[0]?.message?.content ?? '';
      return { text, provider: 'openai' };
    } catch (err) {
      errors.push(`openai: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(
    `No LLM provider succeeded. Tried: ${errors.length > 0 ? errors.join(' | ') : 'none configured'}`,
  );
}
