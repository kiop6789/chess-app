/**
 * Modules activables/désactivables. Mettre un flag à false masque
 * la fonctionnalité (navigation + routes) sans toucher au reste.
 */
export const FEATURES = {
  /** Base de 4600 puzzles Lichess + modes adaptatif/Woodpecker */
  puzzles: true,
  /** Parcours d'entraînement structurés par niveau */
  parcours: true,
  /** Finales interactives contre le moteur */
  finales: true,
  /** Bibliothèque d'ouvertures avec plans */
  ouvertures: true,
  /** Analyse de parties PGN importées */
  analyse: true,
} as const;

export type FeatureKey = keyof typeof FEATURES;
