const WORDS_PER_CHUNK = 600; // ~500 tokens at 0.75 tokens/word
const MIN_CHUNK_WORDS = 20;

export const chunkText = (text: string): string[] => {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  let wordCount = 0;

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).length;
    if (wordCount + words > WORDS_PER_CHUNK && current.trim().length > 0) {
      chunks.push(current.trim());
      current = sentence;
      wordCount = words;
    } else {
      current += ' ' + sentence;
      wordCount += words;
    }
  }

  if (current.trim().length > 0) chunks.push(current.trim());

  return chunks.filter((c) => c.split(/\s+/).length >= MIN_CHUNK_WORDS);
};
