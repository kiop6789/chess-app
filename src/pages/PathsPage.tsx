import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Lock, CheckCircle2, Target, BookOpen, Hourglass, Brain } from 'lucide-react';
import { useProgress } from '@/lib/storage';
import { loadAllPuzzles } from '@/lib/puzzles';
import { useEffect, useState } from 'react';
import type { Puzzle } from '@/types';

interface PathStep {
  kind: 'puzzles' | 'lesson' | 'endgame';
  ref?: string;           // id leçon/finale
  theme?: string;         // thème de puzzles
  count?: number;         // nb de puzzles à résoudre (rating cible)
  label: string;
  detail: string;
}
interface TrainingPath {
  id: string;
  name: string;
  range: [number, number];
  minRating: number;      // rating interne requis pour débloquer
  description: string;
  steps: PathStep[];
}

const PATHS: TrainingPath[] = [
  {
    id: 'debutant', name: 'Débutant', range: [800, 1200], minRating: 0,
    description: 'Les fondations : mats en 1-2, fourchettes, clouages, finales de base.',
    steps: [
      { kind: 'puzzles', theme: 'mat1', count: 10, label: 'Mats en 1', detail: 'Résoudre 10 mats en 1' },
      { kind: 'puzzles', theme: 'fourchette', count: 10, label: 'Fourchettes', detail: 'Résoudre 10 fourchettes (<1400)' },
      { kind: 'puzzles', theme: 'clouage', count: 10, label: 'Clouages', detail: 'Résoudre 10 clouages (<1400)' },
      { kind: 'puzzles', theme: 'mat2', count: 8, label: 'Mats en 2', detail: 'Résoudre 8 mats en 2' },
      { kind: 'lesson', ref: 'tac-fourchette-01', label: 'Leçon : la fourchette', detail: 'Terminer la leçon' },
      { kind: 'lesson', ref: 'ouv-italienne-01', label: 'Leçon : Partie italienne', detail: 'Terminer la leçon' },
      { kind: 'endgame', ref: 'fin-qe-mate', label: 'Finale : dame contre roi', detail: 'Réussir le mat' },
      { kind: 'endgame', ref: 'fin-tour-mate', label: 'Finale : tour contre roi', detail: 'Réussir le mat' },
      { kind: 'endgame', ref: 'fin-echelle', label: 'Finale : l\'échelle', detail: 'Réussir le mat' },
    ],
  },
  {
    id: 'intermediaire', name: 'Intermédiaire', range: [1200, 1600], minRating: 1150,
    description: 'Consolidation : mats en 3, coups intermédiaires, enfilades, finales de pions.',
    steps: [
      { kind: 'puzzles', theme: 'mat', count: 10, label: 'Mats en 3+', detail: 'Résoudre 10 mats en 3 (1200-1700)' },
      { kind: 'puzzles', theme: 'intermediaire', count: 8, label: 'Coups intermédiaires', detail: 'Résoudre 8 coups intermédiaires' },
      { kind: 'puzzles', theme: 'enfilade', count: 8, label: 'Enfilades', detail: 'Résoudre 8 enfilades' },
      { kind: 'puzzles', theme: 'decouverte', count: 8, label: 'Attaques à découvert', detail: 'Résoudre 8 attaques à découvert' },
      { kind: 'puzzles', theme: 'deviation', count: 6, label: 'Déviations', detail: 'Résoudre 6 déviations' },
      { kind: 'lesson', ref: 'fin-opposition-01', label: 'Leçon : l\'opposition', detail: 'Terminer la leçon' },
      { kind: 'lesson', ref: 'strat-pions-01', label: 'Stratégie : structures de pions', detail: 'Terminer la leçon' },
      { kind: 'endgame', ref: 'fin-pion-roi', label: 'Finale : roi + pion', detail: 'Convertir le pion' },
      { kind: 'endgame', ref: 'fin-deux-pions', label: 'Finale : deux pions passés', detail: 'Convertir les pions' },
    ],
  },
  {
    id: 'avance', name: 'Avancé', range: [1600, 2000], minRating: 1550,
    description: 'Vers la maîtrise : calcul profond, finales techniques, stratégie.',
    steps: [
      { kind: 'puzzles', theme: 'sacrifice', count: 12, label: 'Sacrifices', detail: 'Résoudre 12 sacrifices (1600-2100)' },
      { kind: 'puzzles', theme: 'mat', count: 10, label: 'Mats complexes', detail: 'Résoudre 10 mats (1700+)' },
      { kind: 'puzzles', theme: 'calme', count: 6, label: 'Coups calmes', detail: 'Résoudre 6 coups calmes' },
      { kind: 'puzzles', theme: 'finale', count: 10, label: 'Finales tactiques', detail: 'Résoudre 10 puzzles de finale' },
      { kind: 'lesson', ref: 'strat-initiative-01', label: 'Stratégie : l\'initiative', detail: 'Terminer la leçon' },
      { kind: 'lesson', ref: 'strat-espace-01', label: 'Stratégie : l\'espace', detail: 'Terminer la leçon' },
      { kind: 'endgame', ref: 'fin-lucena', label: 'Finale : pont de Lucena', detail: 'Construire le pont' },
      { kind: 'endgame', ref: 'fin-philidor', label: 'Finale : défense Philidor', detail: 'Tenir la nulle' },
    ],
  },
  {
    id: 'expert', name: 'Expert', range: [2000, 2500], minRating: 1950,
    description: 'Le niveau maître : positions subtiles, prophylaxie, technique de conversion.',
    steps: [
      { kind: 'puzzles', theme: 'mat', count: 15, label: 'Mats experts', detail: 'Résoudre 15 mats (2000+)' },
      { kind: 'puzzles', theme: 'sacrifice', count: 15, label: 'Sacrifices profonds', detail: 'Résoudre 15 sacrifices (2000+)' },
      { kind: 'puzzles', theme: 'calme', count: 10, label: 'Coups calmes subtils', detail: 'Résoudre 10 coups calmes (2000+)' },
      { kind: 'puzzles', theme: 'rayonX', count: 8, label: 'Rayons X', detail: 'Résoudre 8 rayons X' },
      { kind: 'lesson', ref: 'strat-prophylaxie-01', label: 'Stratégie : prophylaxie', detail: 'Terminer la leçon' },
      { kind: 'endgame', ref: 'fin-deux-fous', label: 'Finale : mat aux deux fous', detail: 'Réussir le mat' },
    ],
  },
];

function puzzleSuccesses(progress: ReturnType<typeof useProgress>['progress'], puzzles: Puzzle[], theme: string, lo: number, hi: number): number {
  const inRange = new Set(puzzles.filter((p) => p.themes.includes(theme) && p.rating >= lo && p.rating <= hi).map((p) => p.id));
  let n = 0;
  for (const [id, st] of Object.entries(progress.puzzles)) {
    if (st.successes > 0 && inRange.has(id)) n++;
  }
  return n;
}

export function PathsPage() {
  const { progress } = useProgress();
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  useEffect(() => { loadAllPuzzles().then(setPuzzles); }, []);

  const stepDone = (path: TrainingPath, step: PathStep): { done: number; total: number } => {
    if (step.kind === 'lesson') return { done: progress.lessonsCompleted.includes(step.ref!) ? 1 : 0, total: 1 };
    if (step.kind === 'endgame') return { done: progress.endgamesCompleted.includes(step.ref!) ? 1 : 0, total: 1 };
    if (!puzzles) return { done: 0, total: step.count! };
    // Plage de rating du puzzle : la moitié inférieure du parcours + marge
    const lo = Math.max(600, path.range[0] - 200);
    const hi = path.id === 'expert' ? 9999 : path.range[1] + 300;
    return { done: puzzleSuccesses(progress, puzzles, step.theme!, lo, hi), total: step.count! };
  };

  const pathProgress = (path: TrainingPath) => {
    let done = 0, total = 0;
    for (const s of path.steps) {
      const d = stepDone(path, s);
      done += Math.min(d.done, d.total);
      total += d.total;
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parcours d'entraînement</h1>
        <p className="text-zinc-400 mt-1">
          Quatre parcours structurés pour progresser de 800 à 2000+ Elo, couvrant les 5 piliers :
          tactique, finales, ouvertures, stratégie et calcul. Votre rating interne : <strong className="text-emerald-400">{progress.puzzleRating}</strong>
        </p>
      </div>

      <div className="space-y-4">
        {PATHS.map((path) => {
          const locked = progress.puzzleRating < path.minRating;
          const { done, total, pct } = pathProgress(path);
          return (
            <Card key={path.id} className={`bg-zinc-900 border-zinc-800 ${locked ? 'opacity-60' : ''}`}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{path.name}</CardTitle>
                    <Badge variant="outline">{path.range[0]}–{path.range[1] === 2500 ? '2000+' : path.range[1]}</Badge>
                    {locked && (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" /> rating {path.minRating} requis
                      </Badge>
                    )}
                    {pct === 100 && <Badge className="bg-emerald-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Terminé</Badge>}
                  </div>
                  <span className="text-sm text-zinc-400">{done}/{total} · {pct}%</span>
                </div>
                <CardDescription>{path.description}</CardDescription>
                <Progress value={pct} className="h-2 mt-2" />
              </CardHeader>
              {!locked && (
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {path.steps.map((step, i) => {
                      const d = stepDone(path, step);
                      const complete = d.done >= d.total;
                      const Icon = step.kind === 'puzzles' ? Brain : step.kind === 'lesson' ? BookOpen : Hourglass;
                      const to = step.kind === 'puzzles' ? '/puzzles' : step.kind === 'lesson' ? '/lecons' : '/finales';
                      return (
                        <div key={i} className={`flex items-start gap-2.5 rounded-md border p-2.5 ${complete ? 'border-emerald-600/40 bg-emerald-600/10' : 'border-zinc-800 bg-zinc-950/50'}`}>
                          {complete ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" /> : <Icon className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{step.label}</p>
                            <p className="text-xs text-zinc-500">{step.detail}</p>
                            {step.kind === 'puzzles' && (
                              <p className="text-xs text-emerald-400 mt-0.5">{Math.min(d.done, d.total)}/{d.total}</p>
                            )}
                          </div>
                          {!complete && (
                            <Button asChild size="sm" variant="ghost" className="shrink-0 h-7 px-2">
                              <Link to={to}><Target className="h-4 w-4" /></Link>
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
