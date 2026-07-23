import { useCallback, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, XCircle, Lightbulb, ArrowRight, RotateCcw } from 'lucide-react';
import { exercisesByTheme, exerciseElo } from '@/lib/data';
import { useProgress } from '@/lib/storage';
import { SUBTHEME_LABELS, THEME_LABELS, type Exercise } from '@/types';

type Status = 'solving' | 'success' | 'failed';

export function ExercisesPage() {
  const [theme, setTheme] = useState<'tactique' | 'finale' | 'ouverture'>('tactique');
  const { progress, recordExercise } = useProgress();

  // File d'attente figée au changement de thème : révisions dues d'abord,
  // puis nouveaux, puis les autres — par difficulté. (On ne la re-trie pas
  // après chaque résultat pour laisser le feedback de fin d'exercice visible.)
  const queue = useMemo(() => {
    const list = exercisesByTheme(theme);
    const now = Date.now();
    const rank = (ex: Exercise) => {
      const p = progress.exercises[ex.id];
      if (p && p.srs.due > 0 && p.srs.due <= now) return 0;       // à réviser
      if (!p || p.attempts === 0) return 1;                        // jamais vu
      if (p.lastResult === 'fail') return 2;                       // raté récemment
      return 3;
    };
    return [...list].sort((a, b) => rank(a) - rank(b) || exerciseElo(a) - exerciseElo(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const [index, setIndex] = useState(0);
  const exercise = queue[Math.min(index, queue.length - 1)];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Exercices</h1>
        <Tabs value={theme} onValueChange={(v) => { setTheme(v as typeof theme); setIndex(0); }}>
          <TabsList>
            {(['tactique', 'finale', 'ouverture'] as const).map((t) => (
              <TabsTrigger key={t} value={t}>{THEME_LABELS[t]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {exercise ? (
        <ExerciseRunner
          key={exercise.id}
          exercise={exercise}
          position={index + 1}
          total={queue.length}
          onResult={(success, firstTry) => recordExercise(exercise.id, success, firstTry)}
          onNext={() => setIndex((i) => Math.min(i + 1, queue.length - 1))}
          hasNext={index < queue.length - 1}
        />
      ) : (
        <p className="text-zinc-400">Aucun exercice dans ce thème.</p>
      )}
    </div>
  );
}

function ExerciseRunner({ exercise, position, total, onResult, onNext, hasNext }: {
  exercise: Exercise;
  position: number;
  total: number;
  onResult: (success: boolean, firstTry: boolean) => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  // La partie d'exercice part de la position du diagramme.
  const gameRef = useRef(new Chess(exercise.fen));
  const [, setTick] = useState(0);
  const [step, setStep] = useState(0); // prochain coup attendu dans exercise.solution
  const [status, setStatus] = useState<Status>('solving');
  const [wrongCount, setWrongCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const recordedRef = useRef(false);

  const game = gameRef.current;
  const bump = () => setTick((t) => t + 1);
  const orientation = exercise.fen.split(' ')[1] === 'w' ? 'white' : 'black';

  const finish = useCallback((success: boolean) => {
    if (!recordedRef.current) {
      recordedRef.current = true;
      onResult(success, wrongCount === 0);
    }
    setStatus(success ? 'success' : 'failed');
  }, [onResult, wrongCount]);

  const playExpected = useCallback((san: string) => {
    const g = gameRef.current;
    const mv = g.move(san.replace(/[+#!?]+$/, '')) ?? g.move(san);
    if (mv) setLastMove({ from: mv.from, to: mv.to });
  }, []);

  const onMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (status !== 'solving') return false;
    const g = gameRef.current;
    const expected = exercise.solution[step];
    if (!expected) return false;

    // Joue le coup sur une copie pour comparer en notation UCI.
    const test = new Chess(g.fen());
    let mv = null;
    try { mv = test.move({ from, to, promotion }); } catch { return false; }
    if (!mv) return false;

    const expectedUci = (() => {
      const t2 = new Chess(g.fen());
      const m2 = t2.move(expected.replace(/[+#!?]+$/, '')) ?? t2.move(expected);
      return m2 ? m2.from + m2.to : null;
    })();

    if (mv.from + mv.to !== expectedUci) {
      const n = wrongCount + 1;
      setWrongCount(n);
      if (n >= 2) {
        // Deux échecs : on montre la solution.
        playExpected(expected);
        bump();
        if (exercise.solution.length > 1) {
          setTimeout(() => { playExpected(exercise.solution[1]); bump(); }, 600);
        }
        finish(false);
      }
      return false;
    }

    // Bon coup : on l'applique.
    const real = g.move({ from, to, promotion });
    if (real) setLastMove({ from: real.from, to: real.to });
    bump();

    const nextStep = step + 1;
    if (nextStep >= exercise.solution.length) { finish(true); return true; }

    // Réponse automatique de l'adversaire (coups impairs de la solution).
    setTimeout(() => {
      playExpected(exercise.solution[nextStep]);
      bump();
      setStep(nextStep + 1);
      if (nextStep + 1 >= exercise.solution.length) finish(true);
    }, 450);
    setStep(nextStep);
    return true;
  }, [status, exercise, step, wrongCount, finish, playExpected]);

  const restart = () => {
    gameRef.current = new Chess(exercise.fen);
    recordedRef.current = false;
    setStep(0); setStatus('solving'); setWrongCount(0);
    setShowHint(false); setLastMove(null);
    bump();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div className="mx-auto w-full max-w-[540px]">
        <Board
          game={game}
          orientation={orientation}
          interactive={status === 'solving'}
          onMove={onMove}
          lastMove={lastMove}
        />
      </div>

      <div className="space-y-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {SUBTHEME_LABELS[exercise.subtheme] ?? exercise.subtheme}
              </CardTitle>
              <Badge variant="secondary">~{exerciseElo(exercise)} Elo</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Exercice {position}/{total}</span>
              <Progress value={(position / total) * 100} className="h-1.5 flex-1" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {status === 'solving' && (
              <p className="text-sm text-zinc-300">
                {wrongCount === 0 ? 'À vous de jouer — trouvez le meilleur coup !' :
                 <span className="text-red-400 flex items-center gap-1"><XCircle className="h-4 w-4" /> Ce n'est pas ça. Encore un essai !</span>}
              </p>
            )}
            {status === 'success' && (
              <div className="rounded-md bg-emerald-600/15 border border-emerald-600/30 p-3">
                <p className="flex items-center gap-2 font-semibold text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" /> {wrongCount === 0 ? 'Parfait, du premier coup !' : 'Bien joué !'}
                </p>
                <p className="text-sm text-zinc-300 mt-2">{exercise.explanation}</p>
              </div>
            )}
            {status === 'failed' && (
              <div className="rounded-md bg-red-600/10 border border-red-600/30 p-3">
                <p className="flex items-center gap-2 font-semibold text-red-300">
                  <XCircle className="h-5 w-5" /> La solution était : {exercise.solution.join(' ')}
                </p>
                <p className="text-sm text-zinc-300 mt-2">{exercise.explanation}</p>
                <p className="text-xs text-amber-400/80 mt-2">Cet exercice reviendra bientôt en révision.</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {status === 'solving' && (
                <Button variant="outline" size="sm" onClick={() => setShowHint(true)} disabled={showHint}>
                  <Lightbulb className="h-4 w-4 mr-1" /> Indice
                </Button>
              )}
              {status !== 'solving' && (
                <>
                  <Button variant="outline" size="sm" onClick={restart}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Refaire
                  </Button>
                  {hasNext && (
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={onNext}>
                      Suivant <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </>
              )}
            </div>
            {showHint && status === 'solving' && (
              <p className="text-sm text-amber-300/90 bg-amber-500/10 rounded-md p-2">💡 {exercise.hint}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-3 text-xs text-zinc-500">
            Position analysée par Stockfish : la solution est le meilleur coup (ou mat forcé).
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
