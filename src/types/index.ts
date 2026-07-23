import { z } from 'zod';

// ---------- Exercices ----------
export const exerciseSchema = z.object({
  id: z.string(),
  theme: z.enum(['tactique', 'finale', 'ouverture']),
  subtheme: z.string(),
  difficulty: z.number(),
  fen: z.string(),
  solution: z.array(z.string()).min(1),
  explanation: z.string(),
  hint: z.string(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const exerciseIndexSchema = z.object({
  themes: z.array(z.object({ theme: z.string(), file: z.string(), count: z.number() })),
});

// ---------- Leçons ----------
export const lessonSectionSchema = z.object({
  heading: z.string(),
  text: z.string(),
  fen: z.string().optional(),
  moves: z.array(z.string()).optional(),
});
export const lessonSchema = z.object({
  id: z.string(),
  category: z.enum(['ouvertures', 'tactiques', 'finales', 'strategie']),
  title: z.string(),
  level: z.string(),
  intro: z.string(),
  sections: z.array(lessonSectionSchema).min(1),
});
export type Lesson = z.infer<typeof lessonSchema>;
export type LessonSection = z.infer<typeof lessonSectionSchema>;

export const lessonIndexSchema = z.array(z.object({
  id: z.string(),
  file: z.string(),
  category: z.string(),
  title: z.string(),
  level: z.string(),
  intro: z.string(),
  sectionCount: z.number(),
}));
export type LessonIndexEntry = z.infer<typeof lessonIndexSchema>[number];

// ---------- Puzzles (base Lichess) ----------
/** Tuple compact : [id, fen, coups UCI séparés par espaces, rating, masque de thèmes] */
export type PuzzleTuple = [string, string, string, number, number];
export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[]; // identifiants de catégories
}
export const puzzleIndexSchema = z.object({
  bands: z.array(z.object({
    band: z.number(), min: z.number(), max: z.number().nullable(),
    file: z.string(), count: z.number(),
  })),
  categories: z.array(z.string()),
});

export const PUZZLE_CATEGORY_LABELS: Record<string, string> = {
  mat1: 'Mat en 1',
  mat2: 'Mat en 2',
  mat: 'Mats (3+)',
  fourchette: 'Fourchette',
  clouage: 'Clouage',
  enfilade: 'Enfilade',
  decouverte: 'Découverte',
  sacrifice: 'Sacrifice',
  deviation: 'Déviation',
  intermediaire: 'Coup intermédiaire',
  finale: 'Finale',
  pieceEnPrise: 'Pièce en prise',
  promotion: 'Promotion',
  calme: 'Coup calme',
  rayonX: 'Rayon X',
  degagement: 'Dégagement',
};

// ---------- Finales & ouvertures ----------
export const endgameSchema = z.object({
  id: z.string(), name: z.string(), level: z.string(),
  fen: z.string(), side: z.enum(['w', 'b']),
  goal: z.enum(['mate', 'survive']), maxMoves: z.number(),
  intro: z.string(), tip: z.string(),
});
export type Endgame = z.infer<typeof endgameSchema>;

export const openingSchema = z.object({
  id: z.string(), name: z.string(), side: z.enum(['blancs', 'noirs']), for: z.string(),
  description: z.string(),
  lines: z.array(z.object({ name: z.string(), moves: z.array(z.string()), plan: z.string() })),
});
export type Opening = z.infer<typeof openingSchema>;

// ---------- Progression (localStorage) ----------
export interface SrsState {
  ease: number;       // facteur de facilité SM-2 (défaut 2.5)
  interval: number;   // intervalle en jours
  due: number;        // timestamp d'échéance
  reps: number;       // révisions réussies consécutives
}
export interface ExerciseProgress {
  attempts: number;
  successes: number;
  lastResult: 'success' | 'fail' | null;
  lastTried: number;
  srs: SrsState;
}
export interface GameRecord {
  id: string;
  date: number;
  level: number;           // niveau du moteur 1-10
  playerColor: 'w' | 'b';
  result: 'win' | 'loss' | 'draw';
  reason: string;          // mat, abandon, nulle…
  moveCount: number;
  pgn: string;
}

/** Statistiques d'un puzzle de la base Lichess. */
export interface PuzzleProgress {
  attempts: number;
  successes: number;
  lastResult: 'success' | 'fail' | null;
  lastTried: number;
  totalTimeMs: number;     // temps cumulé sur ce puzzle
  woodpecker: number;      // réussites consécutives en mode Woodpecker
}
export interface ThemeStats { attempts: number; successes: number; totalTimeMs: number; }

export interface Progress {
  exercises: Record<string, ExerciseProgress>;
  lessonsCompleted: string[];
  games: GameRecord[];
  // --- v2 : puzzles & gamification ---
  puzzles: Record<string, PuzzleProgress>;
  puzzleRating: number;            // rating interne (démarre à 1000)
  puzzleAttempts: number;          // pour l'amortissement du K
  themeStats: Record<string, ThemeStats>;
  activityDays: string[];          // dates YYYY-MM-DD (streak)
  endgamesCompleted: string[];
}

export const THEME_LABELS: Record<string, string> = {
  tactique: 'Tactiques',
  finale: 'Finales',
  ouverture: 'Ouvertures',
};
export const SUBTHEME_LABELS: Record<string, string> = {
  fourchette: 'Fourchettes',
  clouage: 'Clouages',
  enfilade: 'Enfilades',
  decouverte: 'Attaques à découvert',
  sacrifice: 'Sacrifices',
  zwischenzug: 'Coups intermédiaires',
  pions: 'Finales de pions',
  tours: 'Finales de tours',
  dames: 'Finales de dames',
  pieges: 'Pièges d\'ouverture',
  principes: 'Principes d\'ouverture',
};
