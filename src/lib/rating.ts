/** Rating interne type Elo pour les puzzles. */

export function expectedScore(userRating: number, puzzleRating: number): number {
  return 1 / (1 + Math.pow(10, (puzzleRating - userRating) / 400));
}

/** K décroît avec l'expérience : volatil au début, stable ensuite. */
export function kFactor(attempts: number): number {
  if (attempts < 30) return 40;
  if (attempts < 100) return 24;
  return 16;
}

export function updateRating(userRating: number, puzzleRating: number, success: boolean, attempts: number): number {
  const k = kFactor(attempts);
  const expected = expectedScore(userRating, puzzleRating);
  // Échec = 0 ; succès = 1 (0.7 si le puzzle a demandé plusieurs essais — géré par l'appelant via `success`)
  const score = success ? 1 : 0;
  return Math.round(userRating + k * (score - expected));
}

/** Jours consécutifs d'activité se terminant aujourd'hui (ou hier si rien fait aujourd'hui). */
export function currentStreak(activityDays: string[]): number {
  if (!activityDays.length) return 0;
  const days = new Set(activityDays);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  let cursor = fmt(today);
  if (!days.has(cursor)) {
    // Tolère un trou aujourd'hui : la série court si hier est actif.
    const y = new Date(today.getTime() - 86400000);
    cursor = fmt(y);
    if (!days.has(cursor)) return 0;
  }
  let streak = 0;
  let t = new Date(cursor).getTime();
  while (days.has(fmt(new Date(t)))) {
    streak++;
    t -= 86400000;
  }
  return streak;
}
