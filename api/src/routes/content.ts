import { Router, Request, Response } from 'express';
import multer from 'multer';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { AppError, AuthRequest } from '../types/index';
import { CreateContentSchema } from '../types/schemas';
import { parseFile } from '../services/parser';
import { chunkText } from '../services/chunker';
import { generateQuestionsFromChunk } from '../services/claude';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.file_name, c.created_at, c.topic_id, c.group_id,
              t.name AS topic_name,
              g.name AS group_name,
              COUNT(q.id)::int AS questions_generated
       FROM content c
       LEFT JOIN topics t ON t.id = c.topic_id
       LEFT JOIN content_groups g ON g.id = c.group_id
       LEFT JOIN questions q ON q.content_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id, t.name, g.name
       ORDER BY c.created_at DESC`,
      [user.id],
    );
    res.json({ data: rows });
  }),
);

router.post(
  '/',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const body = req.body as Record<string, string>;

    const topicId = body['topic_id']?.trim() || null;
    const groupId = body['group_id']?.trim() || null;

    let rawText: string;
    let fileName: string | undefined;
    let title: string;

    if (req.file) {
      rawText = await parseFile(req.file.buffer, req.file.mimetype);
      fileName = req.file.originalname;
      title = body['title'] ?? req.file.originalname;
    } else {
      const parsed = CreateContentSchema.safeParse(req.body);
      if (!parsed.success || !parsed.data.text) {
        throw new AppError(400, 'Provide either a file upload or title + text', 'VALIDATION_ERROR');
      }
      rawText = parsed.data.text;
      title = parsed.data.title;
    }

    if (!rawText.trim()) throw new AppError(422, 'No text content found', 'EMPTY_CONTENT');

    const chunks = chunkText(rawText);
    if (chunks.length === 0)
      throw new AppError(422, 'Content too short to generate questions', 'EMPTY_CONTENT');

    const {
      rows: [contentRow],
    } = await pool.query(
      'INSERT INTO content (user_id, title, raw_text, file_name, chunk_count, topic_id, group_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [user.id, title, rawText, fileName ?? null, chunks.length, topicId, groupId],
    );
    const contentId = (contentRow as { id: string }).id;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let questionsGenerated = 0;
    let lastGenerationError: string | null = null;
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) await sleep(4_000);
      const chunk = chunks[i]!;
      try {
        const questions = await generateQuestionsFromChunk(chunk);
        for (const q of questions) {
          await pool.query(
            `INSERT INTO questions
               (content_id, question_text, options, correct_index, explanation, source_text)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [contentId, q.question_text, JSON.stringify(q.options), q.correct_index, q.explanation ?? null, chunk],
          );
          questionsGenerated++;
        }
      } catch (err) {
        lastGenerationError = err instanceof Error ? err.message : String(err);
        console.error(`[content] chunk ${i + 1}/${chunks.length} failed:`, lastGenerationError);
      }
    }

    await pool.query('UPDATE content SET processed_at = now() WHERE id = $1', [contentId]);

    if (questionsGenerated === 0) {
      await pool.query('DELETE FROM content WHERE id = $1', [contentId]);
      const msg = lastGenerationError
        ? `AI generation failed: ${lastGenerationError}`
        : 'Could not generate questions from provided content';
      throw new AppError(422, msg, 'GENERATION_FAILED');
    }

    res.status(201).json({ data: { contentId, questionsGenerated } });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const body = req.body as Record<string, unknown>;
    // group_id may be a UUID string or null (to remove from group)
    const groupId = 'group_id' in body ? (body['group_id'] as string | null) : undefined;
    if (groupId === undefined) throw new AppError(400, 'No updatable fields provided', 'VALIDATION_ERROR');

    const { rows } = await pool.query(
      `UPDATE content SET group_id = $3
       WHERE id = $1 AND user_id = $2
       RETURNING id, group_id`,
      [req.params['id'], user.id, groupId],
    );
    if (rows.length === 0) throw new AppError(404, 'Content not found', 'NOT_FOUND');
    res.json({ data: rows[0] });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const { rows } = await pool.query(
      'DELETE FROM content WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, user.id],
    );
    if (rows.length === 0) throw new AppError(404, 'Content not found', 'NOT_FOUND');
    res.status(204).end();
  }),
);

export default router;
