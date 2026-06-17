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
      `SELECT c.id, c.title, c.file_name, c.created_at,
              COUNT(q.id)::int AS questions_generated
       FROM content c
       LEFT JOIN questions q ON q.content_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
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

    let rawText: string;
    let fileName: string | undefined;
    let title: string;

    if (req.file) {
      rawText = await parseFile(req.file.buffer, req.file.mimetype);
      fileName = req.file.originalname;
      title = (req.body as Record<string, string>)['title'] ?? req.file.originalname;
    } else {
      const body = CreateContentSchema.safeParse(req.body);
      if (!body.success || !body.data.text) {
        throw new AppError(400, 'Provide either a file upload or title + text', 'VALIDATION_ERROR');
      }
      rawText = body.data.text;
      title = body.data.title;
    }

    if (!rawText.trim()) throw new AppError(422, 'No text content found', 'EMPTY_CONTENT');

    const chunks = chunkText(rawText);
    if (chunks.length === 0)
      throw new AppError(422, 'Content too short to generate questions', 'EMPTY_CONTENT');

    const {
      rows: [contentRow],
    } = await pool.query(
      'INSERT INTO content (user_id, title, raw_text, file_name, chunk_count) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [user.id, title, rawText, fileName ?? null, chunks.length],
    );
    const contentId = (contentRow as { id: string }).id;

    let questionsGenerated = 0;
    for (const chunk of chunks) {
      const questions = await generateQuestionsFromChunk(chunk);
      for (const q of questions) {
        await pool.query(
          'INSERT INTO questions (content_id, question_text, options, correct_index) VALUES ($1, $2, $3, $4)',
          [contentId, q.question_text, JSON.stringify(q.options), q.correct_index],
        );
        questionsGenerated++;
      }
    }

    await pool.query('UPDATE content SET processed_at = now() WHERE id = $1', [contentId]);

    if (questionsGenerated === 0) {
      await pool.query('DELETE FROM content WHERE id = $1', [contentId]);
      throw new AppError(422, 'Could not generate questions from provided content', 'GENERATION_FAILED');
    }

    res.status(201).json({ data: { contentId, questionsGenerated } });
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
