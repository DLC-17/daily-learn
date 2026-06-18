import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeneratedQuestion {
  question_text: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation?: string;
}

let _client: GoogleGenerativeAI | undefined;

const getClient = (): GoogleGenerativeAI => {
  if (!_client) {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) throw new Error('GEMINI_API_KEY must be set');
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
};

const SYSTEM_PROMPT = `You are a quiz generator. Given a text passage, generate exactly 3 multiple-choice questions that test comprehension of the content.

Return ONLY a JSON array. Each object must have:
- "question_text": the question string
- "options": array of exactly 4 answer strings
- "correct_index": integer 0–3 indicating the correct option
- "explanation": one sentence explaining the correct answer`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const generateQuestionsFromChunk = async (chunk: string): Promise<GeneratedQuestion[]> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const model = getClient().getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      });

      const result = await model.generateContent(chunk);
      const text = result.response.text();
      const questions = JSON.parse(text) as GeneratedQuestion[];
      if (Array.isArray(questions) && questions.length > 0) return questions;
    } catch (err) {
      const is429 =
        err instanceof Error && (err.message.includes('429') || err.message.includes('quota'));
      if (attempt === 2) {
        console.error(
          '[gemini] chunk failed after 3 attempts:',
          err instanceof Error ? err.message : String(err),
        );
        return [];
      }
      await sleep(is429 ? (attempt + 1) * 15_000 : (attempt + 1) * 5_000);
    }
  }
  return [];
};
