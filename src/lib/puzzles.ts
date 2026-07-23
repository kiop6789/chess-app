import {
  puzzleIndexSchema,
  PUZZLE_CATEGORY_LABELS,
  type Puzzle, type PuzzleTuple,
} from '@/types';
import indexRaw from '@/data/puzzles/index.json';

const puzzleIndex = puzzleIndexSchema.parse(indexRaw);
export const PUZZLE_BANDS = puzzleIndex.bands;
export const PUZZLE_CATEGORIES = puzzleIndex.categories;

// Chargement paresseux des bandes (code-splitting : une bande ≈ 50-90 Ko)
const loaders: Record<number, () => Promise<unknown>> = {
  0: () => import('@/data/puzzles/band0.json'),
  1: () => import('@/data/puzzles/band1.json'),
  2: () => import('@/data/puzzles/band2.json'),
  3: () => import('@/data/puzzles/band3.json'),
  4: () => import('@/data/puzzles/band4.json'),
  5: () => import('@/data/puzzles/band5.json'),
  6: () => import('@/data/puzzles/band6.json'),
};

const cache = new Map<number, Puzzle[]>();

export function maskToThemes(mask: number): string[] {
  const themes: string[] = [];
  for (let i = 0; i < PUZZLE_CATEGORIES.length; i++) {
    if (mask & (1 << i)) themes.push(PUZZLE_CATEGORIES[i]);
  }
  return themes;
}

function toPuzzle(t: PuzzleTuple): Puzzle {
  return { id: t[0], fen: t[1], moves: t[2].split(' '), rating: t[3], themes: maskToThemes(t[4]) };
}

export async function loadBand(band: number): Promise<Puzzle[]> {
  if (cache.has(band)) return cache.get(band)!;
  const mod = (await loaders[band]()) as { default: PuzzleTuple[] };
  const puzzles = mod.default.map(toPuzzle);
  cache.set(band, puzzles);
  return puzzles;
}

/** Toutes les bandes dont l'intervalle recoupe [lo, hi]. */
export function bandsForRating(lo: number, hi: number): number[] {
  return PUZZLE_BANDS
    .filter((b) => (b.max ?? 9999) >= lo && b.min <= hi)
    .map((b) => b.band);
}

export async function loadPuzzlesForRange(lo: number, hi: number): Promise<Puzzle[]> {
  const bands = await Promise.all(bandsForRating(lo, hi).map(loadBand));
  return bands.flat().filter((p) => p.rating >= lo && p.rating <= hi);
}

export async function loadAllPuzzles(): Promise<Puzzle[]> {
  const bands = await Promise.all(Object.keys(loaders).map((k) => loadBand(Number(k))));
  return bands.flat();
}

export function themeLabel(theme: string): string {
  return PUZZLE_CATEGORY_LABELS[theme] ?? theme;
}

/** Nombre de puzzles par thème (chargé paresseusement via loadAllPuzzles si besoin). */
export const BAND_LABELS: Record<number, string> = {
  0: '600–1000', 1: '1000–1300', 2: '1300–1600', 3: '1600–1900',
  4: '1900–2200', 5: '2200–2500', 6: '2500+',
};
