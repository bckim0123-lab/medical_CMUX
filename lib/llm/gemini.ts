import { GoogleGenerativeAI } from '@google/generative-ai';

// Centralized Gemini client. Set GEMINI_API_KEY in .env.local (or Vercel env).
// Switching models or providers happens here, not scattered through agents.

const apiKey = process.env.GEMINI_API_KEY;

export function getGemini() {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  return new GoogleGenerativeAI(apiKey);
}

export const MODEL_FAST = 'gemini-2.5-flash';
export const MODEL_PRO = 'gemini-2.5-pro';
