import api from './api';
import * as db from './db';

interface ServerCard {
  id: string;
  term: string;
  definition: string;
  content_title: string | null;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_due: string | null; // ISO timestamp
}

export async function pushPendingReviews(): Promise<void> {
  const pending = await db.getPendingReviews();
  if (pending.length === 0) return;

  // Deduplicate: send only the latest review outcome per card
  const latestByCard = new Map<string, db.PendingReview>();
  for (const r of pending) {
    const existing = latestByCard.get(r.card_id);
    if (!existing || r.reviewed_at > existing.reviewed_at) {
      latestByCard.set(r.card_id, r);
    }
  }

  const reviews = [...latestByCard.values()].map((r) => ({
    card_id: r.card_id,
    easiness_factor: r.new_easiness_factor,
    interval_days: r.new_interval_days,
    repetitions: r.new_repetitions,
    next_review_due: new Date(r.new_next_review_due).toISOString(),
  }));

  await api.post('/flashcards/sync', { reviews });
  await db.clearPendingReviews(pending.map((r) => r.id));
}

export async function pullReviewQueue(): Promise<void> {
  const { data } = await api.get<{ data: ServerCard[] }>('/flashcards/review-queue?limit=200');
  const cards: db.LocalCard[] = data.data.map((c) => ({
    ...c,
    next_review_due: c.next_review_due ? new Date(c.next_review_due).getTime() : null,
  }));
  await db.upsertCards(cards);
}

// Push pending then pull latest queue from server
export async function fullSync(): Promise<void> {
  await pushPendingReviews();
  await pullReviewQueue();
}
