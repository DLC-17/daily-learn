import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from './db/client';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import contentRouter from './routes/content';
import questionsRouter from './routes/questions';
import quizRouter from './routes/quiz';
import userRouter from './routes/user';

export let schedulerRunning = false;
export const setSchedulerRunning = (value: boolean): void => {
  schedulerRunning = value;
};

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'ok',
      uptime: Math.floor(process.uptime()),
      scheduler: schedulerRunning ? 'running' : 'stopped',
    });
  } catch {
    res.status(503).json({ status: 'error', db: 'unreachable' });
  }
});

app.use('/auth', authRouter);
app.use('/content', contentRouter);
app.use('/questions', questionsRouter);
app.use('/quiz', quizRouter);
app.use('/user', userRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const PORT = parseInt(process.env['PORT'] ?? '8080', 10);
  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

export default app;
