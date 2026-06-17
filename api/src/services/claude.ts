import Anthropic from '@anthropic-ai/sdk';

export interface GeneratedQuestion {
  question_text: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation?: string;
}

interface RawQuestion {
  question_text: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation?: string;
}

let _client: Anthropic | undefined;

const getClient = (): Anthropic => {
  if (!_client) _client = new Anthropic();
  return _client;
};

const SYSTEM_PROMPT = `You are a quiz generator. Given a text passage, generate exactly 3 multiple-choice questions that test comprehension of the content.

Return ONLY a JSON array with no markdown or preamble. Each object must have:
- "question_text": the question string
- "options": array of exactly 4 answer strings
- "correct_index": integer 0–3 indicating the correct option
- "explanation": one sentence explaining the correct answer`;

const parseResponse = (text: string): RawQuestion[] => {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in response');
  return JSON.parse(match[0]) as RawQuestion[];
};

export const generateQuestionsFromChunk = async (chunk: string): Promise<GeneratedQuestion[]> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const message = await getClient().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: chunk }],
      });
      const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
      const questions = parseResponse(text);
      if (questions.length > 0) {
        return questions.map((q) => ({
          question_text: q.question_text,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation,
        }));
      }
    } catch (err) {
      if (attempt === 2) {
        console.error('[claude] chunk failed after 3 attempts:', err instanceof Error ? err.message : String(err));
        return [];
      }
    }
  }
  return [];
};
