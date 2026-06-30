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
    const groupId = (req.query['group_id'] as string) || null;

    const { rows } = await pool.query(
      `SELECT f.id, f.term, f.definition, f.content_id, c.title AS content_title
       FROM flashcards f
       JOIN content c ON c.id = f.content_id
       WHERE c.user_id = $1
         AND ($2::text IS NULL OR c.topic_id::text = $2)
         AND ($3::text IS NULL OR f.content_id::text = $3)
         AND ($4::text IS NULL OR c.group_id::text = $4)
       ORDER BY c.title ASC, f.created_at ASC`,
      [user.id, topicId, contentId, groupId],
    );

    res.json({ data: rows });
  }),
);

// Returns cards due for review with current SR state, oldest-due first
router.get(
  '/review-queue',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const limit = Math.min(parseInt((req.query['limit'] as string) ?? '50', 10), 500);

    const { rows } = await pool.query(
      `SELECT f.id, f.term, f.definition, c.title AS content_title,
              f.easiness_factor, f.interval_days, f.repetitions, f.next_review_due
       FROM flashcards f
       JOIN content c ON c.id = f.content_id
       WHERE c.user_id = $1
         AND (f.next_review_due IS NULL OR f.next_review_due <= now())
       ORDER BY f.next_review_due ASC NULLS FIRST, f.created_at ASC
       LIMIT $2`,
      [user.id, limit],
    );

    res.json({ data: rows });
  }),
);

// Batch-update SR state for reviewed cards (called on reconnect)
router.post(
  '/sync',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const body = req.body as { reviews?: unknown[] };

    if (!Array.isArray(body.reviews) || body.reviews.length === 0) {
      throw new AppError(400, 'reviews array required', 'VALIDATION_ERROR');
    }
    if (body.reviews.length > 500) {
      throw new AppError(400, 'Too many reviews in one batch (max 500)', 'VALIDATION_ERROR');
    }

    let updated = 0;
    for (const item of body.reviews) {
      const r = item as Record<string, unknown>;
      if (
        typeof r['card_id'] !== 'string' ||
        typeof r['easiness_factor'] !== 'number' ||
        typeof r['interval_days'] !== 'number' ||
        typeof r['repetitions'] !== 'number' ||
        typeof r['next_review_due'] !== 'string'
      ) continue;

      const { rowCount } = await pool.query(
        `UPDATE flashcards f
         SET easiness_factor = $3,
             interval_days   = $4,
             repetitions     = $5,
             next_review_due = $6
         FROM content c
         WHERE f.id = $1
           AND f.content_id = c.id
           AND c.user_id = $2`,
        [r['card_id'], user.id, r['easiness_factor'], r['interval_days'], r['repetitions'], r['next_review_due']],
      );
      updated += rowCount ?? 0;
    }

    res.json({ data: { updated } });
  }),
);

router.post(
  '/generate',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const body = req.body as Record<string, unknown>;
    const topicId = (body['topic_id'] as string | undefined) ?? null;
    const groupId = (body['group_id'] as string | undefined) ?? null;
    // content_ids: comma-separated list; falls back to legacy content_id
    const contentIds =
      (body['content_ids'] as string | undefined) ??
      (body['content_id'] as string | undefined) ??
      null;

    const { rows: contentRows } = await pool.query<{ id: string; raw_text: string }>(
      `SELECT id, raw_text FROM content
       WHERE user_id = $1
         AND ($2::text IS NULL OR topic_id::text = $2)
         AND ($3::text IS NULL OR id::text = ANY(string_to_array($3, ',')))
         AND ($4::text IS NULL OR group_id::text = $4)`,
      [user.id, topicId, contentIds, groupId],
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
