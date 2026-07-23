import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '@/components/Board';
import { engine } from '@/engine/stockfish';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ChevronLeft, Flag, Lightbulb, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { ENDGAMES } from '@/lib/data';
import { useProgress } from '@/lib/storage';
import type { Endgame } from '@/types';

const ENGINE_LEVEL = 8; // le moteur défend sérieusement

export function EndgamesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { progress, completeEndgame } = useProgress();
  const eg = ENDGAMES.find((e) => e.id === selectedId) ?? null;

  if (eg) {
    return (
      <EndgameTrainer
        key={eg.id}
        endgame={eg}
        onComplete={() => completeEndgame(eg.id)}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finales interactives</h1>
        <p className="text-zinc-400 mt-1">
          Entraînez-vous à convertir (ou défendre) les finales classiques contre Stockfish, qui défend du mieux possible.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ENDGAMES.map((e) => {
          const done = progress.endgamesCompleted.includes(e.id);
          return (
            <Card key={e.id} className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-colors flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{e.level}</Badge>
                  {done && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                </div>
                <CardTitle className="text-lg">{e.name}</CardTitle>
                <CardDescription>{e.intro}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    {e.goal === 'mate' ? `Objectif : mat (≤${e.maxMoves} coups)` : `Objectif : tenir ${e.maxMoves} coups`}
                  </Badge>
                  <Button size="sm" onClick={() => setSelectedId(e.id)} className="bg-emerald-600 hover:bg-emerald-500">
                    {done ? 'Refaire' : 'S\'entraîner'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function EndgameTrainer({ endgame, onComplete, onBack }: {
  endgame: Endgame;
  onComplete: () => void;
  onBack: () => void;
}) {
  const gameRef = useRef(new Chess(endgame.fen));
  const [, setTick] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [outcome, setOutcome] = useState<'won' | 'lost' | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const savedRef = useRef(false);

  const game = gameRef.current;
  const bump = () => setTick((t) => t + 1);
  const userSide = endgame.side;
  const orientation = userSide === 'w' ? 'white' : 'black';

  const finish = useCallback((won: boolean) => {
    if (!savedRef.current && won) {
      savedRef.current = true;
      onComplete();
    }
    setOutcome(won ? 'won' : 'lost');
  }, [onComplete]);

  const checkEnd = useCallback((): boolean => {
    const g = gameRef.current;
    if (endgame.goal === 'mate') {
      if (g.isCheckmate()) { finish(g.turn() !== userSide); return true; }
      if (g.isStalemate() || g.isInsufficientMaterial() || g.isThreefoldRepetition()) { finish(false); return true; }
      if (moveCount >= endgame.maxMoves) { finish(false); return true; }
    } else {
      // survive : échoue si mat subi, gagne si la limite est tenue
      if (g.isCheckmate() && g.turn() === userSide) { finish(false); return true; }
      if (g.isCheckmate()) { finish(true); return true; }
      if (g.isStalemate() || g.isInsufficientMaterial() || g.isThreefoldRepetition()) { finish(true); return true; }
      if (moveCount >= endgame.maxMoves) { finish(true); return true; }
    }
    return false;
  }, [endgame, moveCount, userSide, finish]);

  const engineTurn = useCallback(async () => {
    const g = gameRef.current;
    if (g.isGameOver()) return;
    setThinking(true);
    try {
      const uci = await engine.playMove(g.fen(), ENGINE_LEVEL);
      if (uci) {
        const mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' });
        if (mv) setLastMove({ from: mv.from, to: mv.to });
      }
    } finally {
      setThinking(false);
      bump();
      checkEnd();
    }
  }, [checkEnd]);

  // Si l'utilisateur joue les Noirs, le moteur ouvre
  useEffect(() => {
    if (endgame.side === 'b' && !outcome && gameRef.current.turn() === 'w') {
      const t = setTimeout(() => engineTurn(), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endgame.id]);

  const onMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const g = gameRef.current;
    if (g.turn() !== userSide || outcome) return false;
    try {
      const mv = g.move({ from, to, promotion });
      if (!mv) return false;
      setLastMove({ from: mv.from, to: mv.to });
    } catch { return false; }
    const n = moveCount + 1;
    setMoveCount(n);
    bump();
    // Vérifie la fin après le coup de l'utilisateur (avec le nouveau compteur)
    const gg = gameRef.current;
    const over = (() => {
      if (endgame.goal === 'mate') {
        if (gg.isCheckmate()) { finish(true); return true; }
        if (gg.isStalemate() || gg.isInsufficientMaterial()) { finish(false); return true; }
        if (n >= endgame.maxMoves) { finish(false); return true; }
      } else {
        if (n >= endgame.maxMoves) { finish(true); return true; }
      }
      return false;
    })();
    if (!over) setTimeout(() => engineTurn(), 250);
    return true;
  }, [userSide, outcome, moveCount, endgame, finish, engineTurn]);

  const restart = () => {
    gameRef.current = new Chess(endgame.fen);
    savedRef.current = false;
    setOutcome(null); setLastMove(null); setMoveCount(0); setShowTip(false);
    bump();
    if (endgame.side === 'b') setTimeout(() => engineTurn(), 400);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Toutes les finales
        </Button>
        <h1 className="text-xl font-bold">{endgame.name}</h1>
        <Badge variant="secondary" className="ml-auto">
          {endgame.goal === 'mate' ? `Mat en ≤${endgame.maxMoves} coups` : `Tenez ${endgame.maxMoves} coups`} · {moveCount} joué{moveCount > 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="mx-auto w-full max-w-[540px]">
          <Board
            game={game}
            orientation={orientation}
            interactive={!outcome && !thinking}
            onMove={onMove}
            lastMove={lastMove}
          />
        </div>
        <div className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Vous jouez les {userSide === 'w' ? 'Blancs' : 'Noirs'}</span>
                {thinking && <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-300">{endgame.intro}</p>
              {outcome === 'won' && (
                <div className="rounded-md bg-emerald-600/15 border border-emerald-600/30 p-3">
                  <p className="flex items-center gap-2 font-semibold text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" /> Objectif atteint, bravo !
                  </p>
                </div>
              )}
              {outcome === 'lost' && (
                <div className="rounded-md bg-red-600/10 border border-red-600/30 p-3">
                  <p className="flex items-center gap-2 font-semibold text-red-300">
                    <XCircle className="h-5 w-5" /> Raté — {endgame.goal === 'mate' ? 'le mat n\'a pas été trouvé à temps (attention au pat !)' : 'vous avez été maté.'}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTip(true)} disabled={showTip}>
                  <Lightbulb className="h-4 w-4 mr-1" /> Conseil
                </Button>
                <Button variant="outline" size="sm" onClick={restart}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Recommencer
                </Button>
                {!outcome && (
                  <Button variant="outline" size="sm" onClick={() => finish(false)}>
                    <Flag className="h-4 w-4 mr-1" /> Abandonner
                  </Button>
                )}
              </div>
              {showTip && (
                <p className="text-sm text-amber-300/90 bg-amber-500/10 rounded-md p-2">💡 {endgame.tip}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
