export type Quality = 4 | 1; // 4 = Got it, 1 = Missed

export interface SR {
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SRResult extends SR {
  nextReviewDue: number; // unix ms
}

export const SM2_DEFAULTS: SR = {
  easinessFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
};

// SM-2 algorithm: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
export function applyReview(state: SR, quality: Quality): SRResult {
  let { easinessFactor, intervalDays, repetitions } = state;

  if (quality >= 3) {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easinessFactor);
    repetitions++;
  } else {
    repetitions = 0;
    intervalDays = 1;
  }

  const q = quality;
  easinessFactor = Math.max(1.3, easinessFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  const nextReviewDue = Date.now() + intervalDays * 24 * 60 * 60 * 1000;
  return { easinessFactor, intervalDays, repetitions, nextReviewDue };
}
