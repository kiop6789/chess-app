import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, XCircle, ArrowRight, Loader2, RotateCcw, Flame, TrendingUp } from 'lucide-react';
import { loadAllPuzzles, loadPuzzlesForRange, themeLabel, BAND_LABELS } from '@/lib/puzzles';
import { useProgress } from '@/lib/storage';
import type { Puzzle } from '@/types';

type Mode = 'adaptatif' | 'theme' | 'niveau' | 'woodpecker';
type Status = 'setup' | 'solving' | 'success' | 'failed';

const WOODPECKER_TARGET = 3; // réussites consécutives pour maîtriser un puzzle

export function PuzzlesPage() {
  const { progress, recordPuzzle } = useProgress();
  const [mode, setMode] = useState<Mode>('adaptatif');
  const [theme, setTheme] = useState<string>('fourchette');
  const [band, setBand] = useState<number>(1);
  const [all, setAll] = useState<Puzzle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [sessionStats, setSessionStats] = useState({ done: 0, ok: 0 });

  // Chargement de la base (une seule fois)
  useEffect(() => {
    let cancelled = false;
    loadAllPuzzles().then((p) => {
      if (!cancelled) { setAll(p); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  /** Sélectionne le prochain puzzle selon le mode. */
  const pickPuzzle = useCallback((pool: Puzzle[]): Puzzle | null => {
    if (!all) return null;
    let candidates: Puzzle[];
    if (mode === 'adaptatif') {
      const r = progress.puzzleRating;
      // Fenêtre élargie si le pool est petit
      let win = 150;
      do {
        candidates = pool.filter((p) => Math.abs(p.rating - r) <= win);
        win += 150;
      } while (candidates.length < 10 && win <= 800);
    } else if (mode === 'theme') {
      candidates = pool.filter((p) => p.themes.includes(theme));
    } else if (mode === 'woodpecker') {
      candidates = pool.filter((p) => {
        const st = progress.puzzles[p.id];
        return st && st.attempts > 0 && st.woodpecker < WOODPECKER_TARGET;
      });
      // Priorité aux échecs les plus récents
      candidates.sort((a, b) => (progress.puzzles[b.id]?.lastTried ?? 0) - (progress.puzzles[a.id]?.lastTried ?? 0));
      if (!candidates.length) return null;
      return candidates[0];
    } else {
      candidates = pool;
    }
    // Évite les puzzles déjà réussis récemment
    const fresh = candidates.filter((p) => {
      const st = progress.puzzles[p.id];
      return !st || st.lastResult !== 'success' || Date.now() - st.lastTried > 7 * 86400000;
    });
    const source = fresh.length ? fresh : candidates;
    if (!source.length) return null;
    return source[Math.floor(Math.random() * source.length)];
  }, [all, mode, theme, progress.puzzleRating, progress.puzzles]);

  const next = useCallback(async () => {
    if (!all) return;
    let pool = all;
    if (mode === 'niveau') {
      const lo = [600, 1000, 1300, 1600, 1900, 2200, 2500][band];
      const hi = [999, 1299, 1599, 1899, 2199, 2499, 9999][band];
      pool = await loadPuzzlesForRange(lo, hi);
    }
    setPuzzle(pickPuzzle(pool));
  }, [all, mode, band, pickPuzzle]);

  // Chargement d'un puzzle dès que la sélection change (mode/thème/niveau)
  // ou qu'aucun puzzle n'est affiché. pickPuzzle lit le mode à jour.
  useEffect(() => {
    if (all && !puzzle) void next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, mode, theme, band, puzzle]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setPuzzle(null);
  };

  const woodpeckerRemaining = useMemo(() => {
    if (!all) return 0;
    return all.filter((p) => {
      const st = progress.puzzles[p.id];
      return st && st.attempts > 0 && st.woodpecker < WOODPECKER_TARGET;
    }).length;
  }, [all, progress.puzzles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" /> Chargement de la base de 4 600 puzzles…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Puzzles</h1>
          <Badge variant="secondary" className="text-sm">
            <TrendingUp className="h-3.5 w-3.5 mr-1" /> Rating : {progress.puzzleRating}
          </Badge>
        </div>
        <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
          <TabsList>
            <TabsTrigger value="adaptatif">Adaptatif</TabsTrigger>
            <TabsTrigger value="theme">Thèmes</TabsTrigger>
            <TabsTrigger value="niveau">Niveaux</TabsTrigger>
            <TabsTrigger value="woodpecker" className="gap-1">
              Woodpecker
              {woodpeckerRemaining > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-xs">{woodpeckerRemaining}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === 'theme' && (
        <div className="flex flex-wrap gap-2">
          {['fourchette', 'clouage', 'enfilade', 'decouverte', 'sacrifice', 'mat1', 'mat2', 'mat', 'intermediaire', 'deviation', 'finale', 'promotion', 'pieceEnPrise'].map((t) => (
            <Button key={t} size="sm" variant={theme === t ? 'default' : 'outline'} onClick={() => { setTheme(t); setPuzzle(null); }}>
              {themeLabel(t)}
            </Button>
          ))}
        </div>
      )}
      {mode === 'niveau' && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(BAND_LABELS).map(([b, label]) => (
            <Button key={b} size="sm" variant={band === Number(b) ? 'default' : 'outline'} onClick={() => { setBand(Number(b)); setPuzzle(null); }}>
              {label}
            </Button>
          ))}
        </div>
      )}
      {mode === 'woodpecker' && (
        <p className="text-sm text-zinc-400">
          <Flame className="inline h-4 w-4 text-amber-400 mr-1" />
          Mode Woodpecker : répétez vos puzzles ratés jusqu'à <strong>{WOODPECKER_TARGET} réussites consécutives</strong>. Restants : <strong>{woodpeckerRemaining}</strong>
        </p>
      )}
      {mode === 'adaptatif' && (
        <p className="text-sm text-zinc-400">
          Les puzzles s'adaptent à votre rating interne ({progress.puzzleRating}) — il monte quand vous réussissez, descend quand vous échouez.
          Session : {sessionStats.ok}/{sessionStats.done} réussis.
        </p>
      )}

      {mode === 'woodpecker' && woodpeckerRemaining === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-8 text-center text-zinc-400">
            🎉 Aucun puzzle à répéter — tous vos ratés sont maîtrisés ! Résolvez de nouveaux puzzles pour alimenter la liste.
          </CardContent>
        </Card>
      ) : puzzle ? (
        <PuzzleRunner
          key={puzzle.id + ':' + (progress.puzzles[puzzle.id]?.attempts ?? 0)}
          puzzle={puzzle}
          mode={mode}
          onResult={(success, firstTry, timeMs) => {
            recordPuzzle(puzzle.id, puzzle.rating, puzzle.themes, success, firstTry, timeMs);
            setSessionStats((s) => ({ done: s.done + 1, ok: s.ok + (success ? 1 : 0) }));
          }}
          onNext={() => { setPuzzle(null); void next(); }}
        />
      ) : (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-8 text-center text-zinc-400">
            Aucun puzzle disponible dans cette sélection.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ runner
function PuzzleRunner({ puzzle, mode, onResult, onNext }: {
  puzzle: Puzzle;
  mode: Mode;
  onResult: (success: boolean, firstTry: boolean, timeMs: number) => void;
  onNext: () => void;
}) {
  // Position de départ : après le coup de mise en place (moves[0], joué par l'adversaire)
  const startGame = useMemo(() => {
    const g = new Chess(puzzle.fen);
    g.move({ from: puzzle.moves[0].slice(0, 2), to: puzzle.moves[0].slice(2, 4), promotion: puzzle.moves[0][4] });
    return g;
  }, [puzzle]);

  const gameRef = useRef(new Chess(startGame.fen()));
  const [, setTick] = useState(0);
  const [step, setStep] = useState(1); // index dans puzzle.moves du prochain coup (utilisateur)
  const [status, setStatus] = useState<Status>('solving');
  const [wrong, setWrong] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>({
    from: puzzle.moves[0].slice(0, 2), to: puzzle.moves[0].slice(2, 4),
  });
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const recordedRef = useRef(false);
  const orientation = startGame.turn() === 'w' ? 'white' : 'black';

  const game = gameRef.current;
  const bump = () => setTick((t) => t + 1);

  // Chronomètre
  useEffect(() => {
    if (status !== 'solving') return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [status]);

  const finish = useCallback((success: boolean) => {
    if (!recordedRef.current) {
      recordedRef.current = true;
      onResult(success, wrong === 0, Date.now() - startTime.current);
    }
    setStatus(success ? 'success' : 'failed');
  }, [onResult, wrong]);

  const autoPlay = useCallback((uci: string) => {
    const g = gameRef.current;
    const mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (mv) setLastMove({ from: mv.from, to: mv.to });
  }, []);

  const onMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (status !== 'solving') return false;
    const g = gameRef.current;
    const expectedUci = puzzle.moves[step];
    if (!expectedUci) return false;

    // Vérifie la légalité sur une copie
    const test = new Chess(g.fen());
    let mv = null;
    try { mv = test.move({ from, to, promotion }); } catch { return false; }
    if (!mv) return false;

    if (mv.from + mv.to !== expectedUci.slice(0, 4)) {
      const n = wrong + 1;
      setWrong(n);
      if (n >= 2) {
        // Montre la solution complète
        autoPlay(expectedUci);
        bump();
        let delay = 550;
        for (let i = step + 1; i < puzzle.moves.length; i++) {
          const uci = puzzle.moves[i];
          setTimeout(() => { autoPlay(uci); bump(); }, delay);
          delay += 550;
        }
        setTimeout(() => finish(false), delay);
      }
      return false;
    }

    // Bon coup
    const real = g.move({ from, to, promotion });
    if (real) setLastMove({ from: real.from, to: real.to });
    bump();

    const nextStep = step + 1;
    if (nextStep >= puzzle.moves.length) { finish(true); return true; }

    // Réponse de l'adversaire
    setTimeout(() => {
      autoPlay(puzzle.moves[nextStep]);
      bump();
      setStep(nextStep + 1);
      if (nextStep + 1 >= puzzle.moves.length) finish(true);
    }, 450);
    setStep(nextStep);
    return true;
  }, [status, puzzle, step, wrong, finish, autoPlay]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const san = (uci: string) => {
    try {
      // Rejoue la solution depuis la position de départ pour l'afficher en SAN
      const seq = new Chess(startGame.fen());
      for (let i = 1; i < puzzle.moves.length; i++) {
        const u = puzzle.moves[i];
        const m = seq.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        if (!m) break;
      }
      return seq.history().join(' ');
    } catch { return uci; }
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
                {orientation === 'white' ? 'Aux Blancs de jouer' : 'Aux Noirs de jouer'}
              </CardTitle>
              <Badge variant="secondary">{puzzle.rating} Elo</Badge>
            </div>
            <div className="flex gap-1 flex-wrap">
              {puzzle.themes.slice(0, 4).map((t) => (
                <Badge key={t} variant="outline" className="text-xs">{themeLabel(t)}</Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {status === 'solving' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">
                  {wrong === 0 ? 'Trouvez le meilleur coup !' : (
                    <span className="text-red-400 flex items-center gap-1"><XCircle className="h-4 w-4" /> Raté. Encore un essai !</span>
                  )}
                </span>
                <span className="font-mono text-zinc-500">{fmtTime(elapsed)}</span>
              </div>
            )}
            {status === 'success' && (
              <div className="rounded-md bg-emerald-600/15 border border-emerald-600/30 p-3">
                <p className="flex items-center gap-2 font-semibold text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" /> {wrong === 0 ? 'Parfait, du premier coup !' : 'Résolu !'}
                </p>
                <p className="text-xs text-zinc-400 mt-1 font-mono">{san('')}</p>
              </div>
            )}
            {status === 'failed' && (
              <div className="rounded-md bg-red-600/10 border border-red-600/30 p-3">
                <p className="flex items-center gap-2 font-semibold text-red-300">
                  <XCircle className="h-5 w-5" /> Solution : {san('')}
                </p>
                <p className="text-xs text-amber-400/80 mt-2">
                  {mode === 'woodpecker' ? 'Compteur Woodpecker remis à zéro pour ce puzzle.' : 'Retrouvez-le en mode Woodpecker pour le maîtriser.'}
                </p>
              </div>
            )}
            {status !== 'solving' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  gameRef.current = new Chess(startGame.fen());
                  recordedRef.current = false;
                  setStep(1); setStatus('solving'); setWrong(0);
                  setLastMove({ from: puzzle.moves[0].slice(0, 2), to: puzzle.moves[0].slice(2, 4) });
                  startTime.current = Date.now();
                  bump();
                }}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Refaire
                </Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={onNext}>
                  Suivant <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-3 text-xs text-zinc-500">
            Puzzle issu de la base open-source Lichess (parties réelles, solutions vérifiées par Stockfish).
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
