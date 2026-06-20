import Groq from 'groq-sdk';

export interface GeneratedQuestion {
  question_text: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation?: string;
}

export interface GeneratedFlashcard {
  term: string;
  definition: string;
}

let _client: Groq | undefined;

const getClient = (): Groq => {
  if (!_client) {
    const apiKey = process.env['GROQ_API_KEY'];
    if (!apiKey) throw new Error('GROQ_API_KEY must be set');
    _client = new Groq({ apiKey });
  }
  return _client;
};

const QUESTION_SYSTEM_PROMPT = `You are a quiz generator. Given a text passage, generate exactly 3 multiple-choice questions that test comprehension of the content.

Return ONLY a JSON object with a "questions" key containing an array. Each object in the array must have:
- "question_text": the question string
- "options": array of exactly 4 answer strings
- "correct_index": integer 0–3 indicating the correct option
- "explanation": one sentence explaining the correct answer`;

const FLASHCARD_SYSTEM_PROMPT = `You are a study aid generator. Given a text passage, extract 5 key terms or concepts and write concise definitions.

Return ONLY a JSON object with a "flashcards" key containing an array. Each object must have:
- "term": the key term or concept (2–6 words, no punctuation)
- "definition": a clear, self-contained explanation (1–2 sentences)`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const generateQuestionsFromChunk = async (chunk: string): Promise<GeneratedQuestion[]> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await getClient().chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: QUESTION_SYSTEM_PROMPT },
          { role: 'user', content: chunk },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 1024,
      });

      const text = completion.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(text) as { questions: GeneratedQuestion[] };
      const questions = parsed.questions;
      if (Array.isArray(questions) && questions.length > 0) return questions;
    } catch (err) {
      const is429 =
        err instanceof Error && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('rate'));
      if (attempt === 2) {
        console.error('[groq] chunk failed after 3 attempts:', err instanceof Error ? err.message : String(err));
        return [];
      }
      await sleep(is429 ? (attempt + 1) * 15_000 : (attempt + 1) * 5_000);
    }
  }
  return [];
};

export const generateFlashcardsFromChunk = async (chunk: string): Promise<GeneratedFlashcard[]> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await getClient().chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: FLASHCARD_SYSTEM_PROMPT },
          { role: 'user', content: chunk },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 768,
      });

      const text = completion.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(text) as { flashcards: GeneratedFlashcard[] };
      const cards = parsed.flashcards;
      if (Array.isArray(cards) && cards.length > 0) return cards;
    } catch (err) {
      const is429 =
        err instanceof Error && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('rate'));
      if (attempt === 2) {
        console.error('[groq] flashcard chunk failed after 3 attempts:', err instanceof Error ? err.message : String(err));
        return [];
      }
      await sleep(is429 ? (attempt + 1) * 15_000 : (attempt + 1) * 5_000);
    }
  }
  return [];
};
