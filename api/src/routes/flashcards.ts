import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { AppError, AuthRequest } from '../types/index';
import { chunkText } from '../services/chunker';
import { generateFlashcardsFromChunk } from '../services/claude';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const topicId = (req.query['topic_id'] as string) || null;
    const contentId = (req.query['content_id'] as string) || null;

    const { rows } = await pool.query(
      `SELECT f.id, f.term, f.definition, f.content_id, c.title AS content_title
       FROM flashcards f
       JOIN content c ON c.id = f.content_id
       WHERE c.user_id = $1
         AND ($2::text IS NULL OR c.topic_id::text = $2)
         AND ($3::text IS NULL OR f.content_id::text = $3)
       ORDER BY c.title ASC, f.created_at ASC`,
      [user.id, topicId, contentId],
    );

    res.json({ data: rows });
  }),
);

router.post(
  '/generate',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const body = req.body as Record<string, unknown>;
    const topicId = (body['topic_id'] as string | undefined) ?? null;
    const contentId = (body['content_id'] as string | undefined) ?? null;

    if (!topicId && !contentId) {
      throw new AppError(400, 'Provide topic_id or content_id', 'VALIDATION_ERROR');
    }

    const { rows: contentRows } = await pool.query<{ id: string; raw_text: string }>(
      `SELECT id, raw_text FROM content
       WHERE user_id = $1
         AND ($2::text IS NULL OR topic_id::text = $2)
         AND ($3::text IS NULL OR id::text = $3)`,
      [user.id, topicId, contentId],
    );

    if (contentRows.length === 0) {
      throw new AppError(404, 'No content found', 'NOT_FOUND');
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let totalGenerated = 0;

    for (const content of contentRows) {
      // Delete existing flashcards so generation is always fresh
      await pool.query('DELETE FROM flashcards WHERE content_id = $1', [content.id]);

      const chunks = chunkText(content.raw_text).slice(0, 3); // max 3 chunks per content
      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await sleep(4_000);
        const cards = await generateFlashcardsFromChunk(chunks[i]!);
        for (const card of cards) {
          await pool.query(
            'INSERT INTO flashcards (content_id, term, definition) VALUES ($1, $2, $3)',
            [content.id, card.term, card.definition],
          );
          totalGenerated++;
        }
      }
    }

    res.json({ data: { flashcardsGenerated: totalGenerated } });
  }),
);

export default router;
