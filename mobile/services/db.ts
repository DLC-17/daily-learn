import * as SQLite from 'expo-sqlite';

export interface LocalCard {
  id: string;
  term: string;
  definition: string;
  content_title: string | null;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_due: number | null; // unix ms; null = new card (never reviewed)
}

export interface PendingReview {
  id: number;
  card_id: string;
  reviewed_at: number;
  quality: number;
  new_easiness_factor: number;
  new_interval_days: number;
  new_repetitions: number;
  new_next_review_due: number;
}

let _db: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = SQLite.openDatabaseAsync('daily_learn.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS cards (
          id TEXT PRIMARY KEY,
          term TEXT NOT NULL,
          definition TEXT NOT NULL,
          content_title TEXT,
          easiness_factor REAL NOT NULL DEFAULT 2.5,
          interval_days INTEGER NOT NULL DEFAULT 0,
          repetitions INTEGER NOT NULL DEFAULT 0,
          next_review_due INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(next_review_due);

        CREATE TABLE IF NOT EXISTS pending_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          card_id TEXT NOT NULL,
          reviewed_at INTEGER NOT NULL,
          quality INTEGER NOT NULL,
          new_easiness_factor REAL NOT NULL,
          new_interval_days INTEGER NOT NULL,
          new_repetitions INTEGER NOT NULL,
          new_next_review_due INTEGER NOT NULL
        );
      `);
      return db;
    });
  }
  return _db;
}

export async function upsertCards(cards: LocalCard[]): Promise<void> {
  if (cards.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const c of cards) {
      await db.runAsync(
        `INSERT INTO cards
           (id, term, definition, content_title, easiness_factor, interval_days, repetitions, next_review_due)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           term = excluded.term,
           definition = excluded.definition,
           content_title = excluded.content_title,
           easiness_factor = excluded.easiness_factor,
           interval_days = excluded.interval_days,
           repetitions = excluded.repetitions,
           next_review_due = excluded.next_review_due`,
        c.id,
        c.term,
        c.definition,
        c.content_title,
        c.easiness_factor,
        c.interval_days,
        c.repetitions,
        c.next_review_due,
      );
    }
  });
}

export async function getDueCards(limit = 30): Promise<LocalCard[]> {
  const db = await getDb();
  return db.getAllAsync<LocalCard>(
    `SELECT * FROM cards
     WHERE next_review_due IS NULL OR next_review_due <= ?
     ORDER BY next_review_due ASC NULLS FIRST, id ASC
     LIMIT ?`,
    Date.now(),
    limit,
  );
}

export async function updateCardProgress(
  id: string,
  ef: number,
  intervalDays: number,
  repetitions: number,
  nextReviewDue: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE cards SET easiness_factor=?, interval_days=?, repetitions=?, next_review_due=? WHERE id=?',
    ef,
    intervalDays,
    repetitions,
    nextReviewDue,
    id,
  );
}

export async function addPendingReview(
  cardId: string,
  quality: number,
  ef: number,
  intervalDays: number,
  repetitions: number,
  nextDue: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pending_reviews
       (card_id, reviewed_at, quality, new_easiness_factor, new_interval_days, new_repetitions, new_next_review_due)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    cardId,
    Date.now(),
    quality,
    ef,
    intervalDays,
    repetitions,
    nextDue,
  );
}

export async function getPendingReviews(): Promise<PendingReview[]> {
  const db = await getDb();
  return db.getAllAsync<PendingReview>(
    'SELECT * FROM pending_reviews ORDER BY reviewed_at ASC',
  );
}

export async function clearPendingReviews(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  // runAsync with spread of ids as individual params
  await db.runAsync(
    `DELETE FROM pending_reviews WHERE id IN (${placeholders})`,
    ...ids,
  );
}

export async function getStats(): Promise<{ total: number; due: number; pending: number }> {
  const db = await getDb();
  const now = Date.now();
  const [totRow, dueRow, pendRow] = await Promise.all([
    db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM cards'),
    db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM cards WHERE next_review_due IS NULL OR next_review_due <= ?',
      now,
    ),
    db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM pending_reviews'),
  ]);
  return {
    total: totRow?.n ?? 0,
    due: dueRow?.n ?? 0,
    pending: pendRow?.n ?? 0,
  };
}

export async function getNextDueTimestamp(): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ next_review_due: number | null }>(
    'SELECT MIN(next_review_due) AS next_review_due FROM cards WHERE next_review_due IS NOT NULL AND next_review_due > ?',
    Date.now(),
  );
  return row?.next_review_due ?? null;
}
