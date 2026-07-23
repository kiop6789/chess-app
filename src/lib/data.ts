import { z } from 'zod';
import {
  exerciseSchema, lessonSchema, lessonIndexSchema,
  type Exercise, type Lesson, type LessonIndexEntry,
} from '@/types';

import tactiques from '@/data/exercises/tactiques.json';
import finales from '@/data/exercises/finales.json';
import ouvertures from '@/data/exercises/ouvertures.json';
import lessonIndexRaw from '@/data/lessons/index.json';
import lessonItalienne from '@/data/lessons/ouvertures/ouv-italienne-01.json';
import lessonFourchette from '@/data/lessons/tactiques/tac-fourchette-01.json';
import lessonOpposition from '@/data/lessons/finales/fin-opposition-01.json';
import lessonPions from '@/data/lessons/strategie/strat-pions-01.json';
import lessonInitiative from '@/data/lessons/strategie/strat-initiative-01.json';
import lessonEspace from '@/data/lessons/strategie/strat-espace-01.json';
import lessonProphylaxie from '@/data/lessons/strategie/strat-prophylaxie-01.json';
import endgamesRaw from '@/data/endgames.json';
import openingsRaw from '@/data/openings.json';
import { endgameSchema, openingSchema, type Endgame, type Opening } from '@/types';

// Validation zod au chargement : une donnée corrompue lève une erreur explicite.
export const EXERCISES: Exercise[] = z.array(exerciseSchema).parse([
  ...tactiques, ...finales, ...ouvertures,
]);

export const LESSONS: Lesson[] = z.array(lessonSchema).parse([
  lessonItalienne, lessonFourchette, lessonOpposition,
  lessonPions, lessonInitiative, lessonEspace, lessonProphylaxie,
]);

export const ENDGAMES: Endgame[] = z.array(endgameSchema).parse(endgamesRaw);
export const OPENINGS: Opening[] = z.array(openingSchema).parse(openingsRaw);

export const LESSON_INDEX: LessonIndexEntry[] = lessonIndexSchema.parse(lessonIndexRaw);

export const exercisesByTheme = (theme: Exercise['theme']) =>
  EXERCISES.filter((e) => e.theme === theme);

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id);
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

/** Normalise la difficulté d'un exercice vers une cote Elo estimée. */
export function exerciseElo(ex: Exercise): number {
  if (ex.theme === 'tactique') return ex.difficulty; // déjà en cote Elo
  // finales / ouvertures : échelle 1-3 → cote approximative
  return [700, 1000, 1350][Math.min(2, Math.max(0, ex.difficulty - 1))];
}
