import { useCallback, useEffect, useState } from 'react';
import type { ExerciseProgress, GameRecord, Progress, PuzzleProgress } from '@/types';
import { updateRating } from '@/lib/rating';

const KEY = 'maitrise-echecs.progress.v1';

const empty: Progress = {
  exercises: {},
  lessonsCompleted: [],
  games: [],
  puzzles: {},
  puzzleRating: 1000,
  puzzleAttempts: 0,
  themeStats: {},
  activityDays: [],
  endgamesCompleted: [],
};

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(empty);
    const parsed = JSON.parse(raw) as Partial<Progress>;
    // Fusion avec les défauts : les données v1 sont conservées.
    return {
      ...structuredClone(empty),
      ...parsed,
      exercises: parsed.exercises ?? {},
      puzzles: parsed.puzzles ?? {},
      themeStats: parsed.themeStats ?? {},
      activityDays: parsed.activityDays ?? [],
      endgamesCompleted: parsed.endgamesCompleted ?? [],
      lessonsCompleted: parsed.lessonsCompleted ?? [],
      games: parsed.games ?? [],
    };
  } catch {
    return structuredClone(empty);
  }
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota */ }
}

function touchActivity(p: Progress): Progress {
  const today = new Date().toISOString().slice(0, 10);
  return p.activityDays.includes(today) ? p : { ...p, activityDays: [...p.activityDays, today].slice(-400) };
}

/** Hook réactif sur la progression persistée. */
export function useProgress() {
  const [progress, setProgress] = useState<Progress>(loadProgress);

  useEffect(() => { saveProgress(progress); }, [progress]);

  const recordExercise = useCallback((id: string, success: boolean, firstTry: boolean) => {
    setProgress((prev) => {
      const old: ExerciseProgress = prev.exercises[id] ?? {
        attempts: 0, successes: 0, lastResult: null, lastTried: 0,
        srs: { ease: 2.5, interval: 0, due: 0, reps: 0 },
      };
      const quality = success ? (firstTry ? 5 : 4) : 1;
      const srs = sm2(old.srs, quality);
      return touchActivity({
        ...prev,
        exercises: {
          ...prev.exercises,
          [id]: {
            attempts: old.attempts + 1,
            successes: old.successes + (success ? 1 : 0),
            lastResult: success ? 'success' : 'fail',
            lastTried: Date.now(),
            srs,
          },
        },
      });
    });
  }, []);

  /** Enregistre une tentative de puzzle : met à jour rating, stats thème, streak. */
  const recordPuzzle = useCallback((id: string, rating: number, themes: string[], success: boolean, firstTry: boolean, timeMs: number) => {
    setProgress((prev) => {
      const old: PuzzleProgress = prev.puzzles[id] ?? {
        attempts: 0, successes: 0, lastResult: null, lastTried: 0, totalTimeMs: 0, woodpecker: 0,
      };
      // Rating : succès complet = 1, succès au 2e essai = 0.7, échec = 0
      const ratingScore = success ? (firstTry ? 1 : 0.7) : 0;
      const k = prev.puzzleAttempts < 30 ? 40 : prev.puzzleAttempts < 100 ? 24 : 16;
      const expected = 1 / (1 + Math.pow(10, (rating - prev.puzzleRating) / 400));
      const newRating = Math.round(prev.puzzleRating + k * (ratingScore - expected));

      const themeStats = { ...prev.themeStats };
      for (const t of themes) {
        const s = themeStats[t] ?? { attempts: 0, successes: 0, totalTimeMs: 0 };
        themeStats[t] = {
          attempts: s.attempts + 1,
          successes: s.successes + (success ? 1 : 0),
          totalTimeMs: s.totalTimeMs + timeMs,
        };
      }

      return touchActivity({
        ...prev,
        puzzleRating: newRating,
        puzzleAttempts: prev.puzzleAttempts + 1,
        themeStats,
        puzzles: {
          ...prev.puzzles,
          [id]: {
            attempts: old.attempts + 1,
            successes: old.successes + (success ? 1 : 0),
            lastResult: success ? 'success' : 'fail',
            lastTried: Date.now(),
            totalTimeMs: old.totalTimeMs + timeMs,
            woodpecker: success ? old.woodpecker + 1 : 0,
          },
        },
      });
    });
  }, []);

  const completeLesson = useCallback((id: string) => {
    setProgress((prev) => prev.lessonsCompleted.includes(id)
      ? prev
      : touchActivity({ ...prev, lessonsCompleted: [...prev.lessonsCompleted, id] }));
  }, []);

  const completeEndgame = useCallback((id: string) => {
    setProgress((prev) => prev.endgamesCompleted.includes(id)
      ? prev
      : touchActivity({ ...prev, endgamesCompleted: [...prev.endgamesCompleted, id] }));
  }, []);

  const recordGame = useCallback((game: GameRecord) => {
    setProgress((prev) => touchActivity({ ...prev, games: [game, ...prev.games].slice(0, 100) }));
  }, []);

  const resetAll = useCallback(() => setProgress(structuredClone(empty)), []);

  return { progress, recordExercise, recordPuzzle, completeLesson, completeEndgame, recordGame, resetAll };
}

// ---------- Algorithme SM-2 (répétition espacée) ----------
import type { SrsState } from '@/types';

export function sm2(state: SrsState, quality: number): SrsState {
  let { ease, interval, reps } = state;
  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  if (quality < 3) {
    reps = 0;
    interval = 1; // échec → revoir demain
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
  }
  const due = Date.now() + interval * 24 * 3600 * 1000;
  return { ease, interval, due, reps };
}

/** Nombre d'exercices dus pour révision. */
export function dueCount(progress: Progress, ids: string[]): number {
  const now = Date.now();
  return ids.filter((id) => {
    const p = progress.exercises[id];
    return p && p.srs.due > 0 && p.srs.due <= now;
  }).length;
}

// Ré-exporté pour les composants existants
export { updateRating };
