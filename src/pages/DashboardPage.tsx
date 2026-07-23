import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { EXERCISES, exerciseElo, exercisesByTheme } from '@/lib/data';
import { useProgress } from '@/lib/storage';
import { currentStreak } from '@/lib/rating';
import { themeLabel } from '@/lib/puzzles';
import { THEME_LABELS } from '@/types';
import { Trophy, Target, Clock, Trash2, Swords, Flame, Brain, Hourglass } from 'lucide-react';

function estimateElo(progress: ReturnType<typeof useProgress>['progress']): number | null {
  let sumW = 0, sumPerf = 0;
  for (const ex of EXERCISES) {
    const p = progress.exercises[ex.id];
    if (!p || p.attempts === 0) continue;
    const rate = p.successes / p.attempts;
    // Performance : réussir un exercice coté X au premier coup ≈ X+150 ; échouer ≈ X−200.
    const firstTryBonus = p.srs.reps > 0 ? 150 : 0;
    const perf = exerciseElo(ex) + (rate > 0 ? firstTryBonus : -200);
    const w = p.attempts;
    sumW += w; sumPerf += perf * w;
  }
  if (sumW < 3) return null; // trop peu de données
  return Math.round(Math.min(2200, Math.max(600, sumPerf / sumW)));
}

const levelElo = (l: number) => 400 + l * 160;

export function DashboardPage() {
  const { progress, resetAll } = useProgress();
  const elo = estimateElo(progress);

  const themeStats = (['tactique', 'finale', 'ouverture'] as const).map((t) => {
    const list = exercisesByTheme(t);
    let attempts = 0, successes = 0, solved = 0;
    for (const ex of list) {
      const p = progress.exercises[ex.id];
      if (p) {
        attempts += p.attempts;
        successes += p.successes;
        if (p.successes > 0) solved++;
      }
    }
    return { theme: t, total: list.length, attempts, successes, solved };
  });

  const now = Date.now();
  const dueList = EXERCISES.filter((ex) => {
    const p = progress.exercises[ex.id];
    return p && p.srs.due > 0 && p.srs.due <= now;
  });

  const gamesWon = progress.games.filter((g) => g.result === 'win').length;
  const gamesDrawn = progress.games.filter((g) => g.result === 'draw').length;
  const bestWin = progress.games.filter((g) => g.result === 'win').reduce((m, g) => Math.max(m, g.level), 0);

  const streak = currentStreak(progress.activityDays);
  const bestStreak = (() => {
    const days = [...new Set(progress.activityDays)].sort();
    let best = 0, cur = 0, prev = '';
    for (const d of days) {
      cur = prev && (new Date(d).getTime() - new Date(prev).getTime() === 86400000) ? cur + 1 : 1;
      best = Math.max(best, cur);
      prev = d;
    }
    return best;
  })();
  const puzzleAttempts = Object.values(progress.puzzles).reduce((s, p) => s + p.attempts, 0);
  const puzzleSuccesses = Object.values(progress.puzzles).reduce((s, p) => s + p.successes, 0);
  const woodpeckerLeft = Object.values(progress.puzzles).filter((p) => p.attempts > 0 && p.woodpecker < 3).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Votre progression</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-red-400 border-red-900 hover:bg-red-950">
              <Trash2 className="h-4 w-4 mr-1" /> Réinitialiser
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Effacer toute la progression ?</AlertDialogTitle>
              <AlertDialogDescription>
                Exercices, leçons et historique des parties seront définitivement supprimés de ce navigateur.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={resetAll}>Tout effacer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Vue d'ensemble */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Brain className="h-4 w-4" /> Rating puzzles</CardDescription>
            <CardTitle className="text-3xl text-emerald-400">{progress.puzzleRating}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">
            {progress.puzzleAttempts} puzzle{progress.puzzleAttempts > 1 ? 's' : ''} tenté{progress.puzzleAttempts > 1 ? 's' : ''}
            {puzzleAttempts > 0 ? ` · ${Math.round((puzzleSuccesses / puzzleAttempts) * 100)}% de réussite` : ''}
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Flame className="h-4 w-4" /> Série d'activité</CardDescription>
            <CardTitle className="text-3xl text-amber-400">{streak}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">
            jour{streak > 1 ? 's' : ''} consécutif{streak > 1 ? 's' : ''} · record {bestStreak}
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Target className="h-4 w-4" /> Elo estimé</CardDescription>
            <CardTitle className="text-3xl">{elo ?? '—'}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">
            {elo ? 'Basé sur vos résultats aux exercices' : 'Résolvez quelques exercices pour l\'estimer'}
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Swords className="h-4 w-4" /> Parties</CardDescription>
            <CardTitle className="text-3xl">{gamesWon}<span className="text-lg text-zinc-500">V</span> {gamesDrawn}<span className="text-lg text-zinc-500">N</span> {progress.games.length - gamesWon - gamesDrawn}<span className="text-lg text-zinc-500">D</span></CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">
            {bestWin > 0 ? `Meilleure victoire : niveau ${bestWin} (~${levelElo(bestWin)} Elo)` : 'aucune victoire pour l\'instant'}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Trophy className="h-4 w-4" /> Exercices résolus</CardDescription>
            <CardTitle className="text-2xl">{themeStats.reduce((s, t) => s + t.solved, 0)}<span className="text-lg text-zinc-500">/{EXERCISES.length}</span></CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Clock className="h-4 w-4" /> À réviser</CardDescription>
            <CardTitle className="text-2xl text-amber-400">{dueList.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">répétition espacée</CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Brain className="h-4 w-4" /> Woodpecker</CardDescription>
            <CardTitle className="text-2xl">{woodpeckerLeft}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">puzzle{woodpeckerLeft > 1 ? 's' : ''} à re-maîtriser</CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Hourglass className="h-4 w-4" /> Finales maîtrisées</CardDescription>
            <CardTitle className="text-2xl">{progress.endgamesCompleted.length}<span className="text-lg text-zinc-500">/8</span></CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Statistiques par thème de puzzle */}
      {Object.keys(progress.themeStats).length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Précision par thème de puzzle</CardTitle>
            <CardDescription>Taux de réussite et temps moyen de résolution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(progress.themeStats)
                .sort((a, b) => b[1].attempts - a[1].attempts)
                .map(([theme, s]) => {
                  const rate = Math.round((s.successes / s.attempts) * 100);
                  const avgSec = Math.round(s.totalTimeMs / s.attempts / 1000);
                  return (
                    <div key={theme} className="rounded-md border border-zinc-800 p-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{themeLabel(theme)}</span>
                        <span className={rate >= 70 ? 'text-emerald-400' : rate >= 45 ? 'text-amber-400' : 'text-red-400'}>{rate}%</span>
                      </div>
                      <Progress value={rate} className="h-1.5 mt-2" />
                      <p className="text-xs text-zinc-500 mt-1">{s.attempts} tenté{s.attempts > 1 ? 's' : ''} · ~{avgSec}s par puzzle</p>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques par thème */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Précision par thème</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {themeStats.map(({ theme, total, attempts, successes, solved }) => {
            const rate = attempts > 0 ? Math.round((successes / attempts) * 100) : 0;
            return (
              <div key={theme} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>{THEME_LABELS[theme]}</span>
                  <span className="text-zinc-400">
                    {solved}/{total} résolus · {attempts > 0 ? `${rate}% de réussite` : 'jamais tenté'}
                  </span>
                </div>
                <Progress value={total > 0 ? (solved / total) * 100 : 0} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Historique des parties */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Historique des parties</CardTitle>
          <CardDescription>Vos {progress.games.length} dernières parties contre Stockfish</CardDescription>
        </CardHeader>
        <CardContent>
          {progress.games.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucune partie jouée pour l'instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Adversaire</th>
                    <th className="py-2 pr-4">Couleur</th>
                    <th className="py-2 pr-4">Résultat</th>
                    <th className="py-2">Coups</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.games.slice(0, 20).map((g) => (
                    <tr key={g.id} className="border-b border-zinc-800/50">
                      <td className="py-2 pr-4 text-zinc-400">{new Date(g.date).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 pr-4">Stockfish niv. {g.level}</td>
                      <td className="py-2 pr-4">{g.playerColor === 'w' ? 'Blancs' : 'Noirs'}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={g.result === 'win' ? 'default' : g.result === 'loss' ? 'destructive' : 'secondary'}
                          className={g.result === 'win' ? 'bg-emerald-600' : ''}>
                          {g.result === 'win' ? 'Victoire' : g.result === 'loss' ? 'Défaite' : 'Nulle'}
                        </Badge>
                        <span className="text-xs text-zinc-500 ml-2">{g.reason}</span>
                      </td>
                      <td className="py-2 text-zinc-400">{g.moveCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
