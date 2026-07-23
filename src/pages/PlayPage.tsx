import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '@/components/Board';
import { engine } from '@/engine/stockfish';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Flag, RotateCcw, Search } from 'lucide-react';
import { useProgress } from '@/lib/storage';
import { ScrollArea } from '@/components/ui/scroll-area';

type Phase = 'setup' | 'playing' | 'over';

interface MoveEval {
  san: string;
  color: 'w' | 'b';
  cpBefore: number;   // du point de vue des Blancs
  cpAfter: number;
  loss: number;       // perte en centipions pour le camp ayant joué
}

export function PlayPage() {
  const gameRef = useRef(new Chess());
  const [, setTick] = useState(0);
  const [phase, setPhase] = useState<Phase>('setup');
  const [level, setLevel] = useState(5);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [engineThinking, setEngineThinking] = useState(false);
  const [endInfo, setEndInfo] = useState<{ result: 'win' | 'loss' | 'draw'; reason: string } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [analysis, setAnalysis] = useState<MoveEval[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const { recordGame } = useProgress();
  const savedRef = useRef(false);

  const game = gameRef.current;
  const bump = () => setTick((t) => t + 1);

  const checkEnd = useCallback((): boolean => {
    const g = gameRef.current;
    if (!g.isGameOver()) return false;
    let result: 'win' | 'loss' | 'draw';
    let reason: string;
    if (g.isCheckmate()) {
      const loser = g.turn();
      result = loser === playerColor ? 'loss' : 'win';
      reason = 'Échec et mat';
    } else if (g.isStalemate()) { result = 'draw'; reason = 'Pat'; }
    else if (g.isThreefoldRepetition()) { result = 'draw'; reason = 'Triple répétition'; }
    else if (g.isInsufficientMaterial()) { result = 'draw'; reason = 'Matériel insuffisant'; }
    else { result = 'draw'; reason = 'Règle des 50 coups'; }
    setEndInfo({ result, reason });
    setPhase('over');
    return true;
  }, [playerColor]);

  const engineTurn = useCallback(async () => {
    const g = gameRef.current;
    if (g.isGameOver()) return;
    setEngineThinking(true);
    try {
      const uci = await engine.playMove(g.fen(), level);
      if (uci) {
        const mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' });
        if (mv) setLastMove({ from: mv.from, to: mv.to });
      }
    } catch (e) {
      console.error(e);
      setEngineError("Le moteur n'a pas répondu. Rechargez la page.");
    }
    setEngineThinking(false);
    bump();
    checkEnd();
  }, [level, checkEnd]);

  const startGame = useCallback(() => {
    gameRef.current = new Chess();
    savedRef.current = false;
    setLastMove(null);
    setEndInfo(null);
    setAnalysis(null);
    setEngineError(null);
    setPhase('playing');
    bump();
    if (playerColor === 'b') {
      // Le moteur joue les Blancs : il ouvre la partie.
      setTimeout(() => engineTurn(), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerColor]);

  const onMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const g = gameRef.current;
    if (g.turn() !== playerColor || g.isGameOver()) return false;
    try {
      const mv = g.move({ from, to, promotion });
      if (!mv) return false;
      setLastMove({ from: mv.from, to: mv.to });
    } catch { return false; }
    bump();
    if (!checkEnd()) setTimeout(() => engineTurn(), 250);
    return true;
  }, [playerColor, checkEnd, engineTurn]);

  // Enregistre la partie terminée (une seule fois)
  useEffect(() => {
    if (phase === 'over' && endInfo && !savedRef.current) {
      savedRef.current = true;
      const g = gameRef.current;
      recordGame({
        id: crypto.randomUUID(),
        date: Date.now(),
        level,
        playerColor,
        result: endInfo.result,
        reason: endInfo.reason,
        moveCount: Math.ceil(g.history().length / 2),
        pgn: g.pgn(),
      });
    }
  }, [phase, endInfo, level, playerColor, recordGame]);

  const resign = () => {
    setEndInfo({ result: 'loss', reason: 'Abandon' });
    setPhase('over');
  };

  const downloadPgn = () => {
    const g = gameRef.current;
    const header = [
      `[Event "Partie amicale — Maîtrise des Échecs"]`,
      `[Site "Local"]`,
      `[Date "${new Date().toISOString().slice(0, 10).replaceAll('-', '.')}"]`,
      `[White "${playerColor === 'w' ? 'Joueur' : `Stockfish niv. ${level}`}"]`,
      `[Black "${playerColor === 'b' ? 'Joueur' : `Stockfish niv. ${level}`}"]`,
      `[Result "${endInfo ? (endInfo.result === 'draw' ? '1/2-1/2' : (endInfo.result === 'win' ? (playerColor === 'w' ? '1-0' : '0-1') : (playerColor === 'w' ? '0-1' : '1-0'))) : '*'}"]`,
      '',
    ].join('\n');
    const blob = new Blob([header + g.pgn({ maxWidth: 80 })], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `partie-niveau-${level}.pgn`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ---------- Analyse post-partie ----------
  const analyzeGame = async () => {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const g = gameRef.current;
      const history = g.history({ verbose: true });
      const replay = new Chess();
      // Évalue chaque position : perte d'un coup = eval(avant) − eval(après) pour son auteur.
      const cps: number[] = [];
      for (let i = 0; i <= history.length; i++) {
        const cands = replay.isGameOver() ? [] : await engine.analyze(replay.fen(), { movetime: 150, multipv: 1 });
        cps.push(cands[0] ? (replay.turn() === 'w' ? cands[0].cp : -cands[0].cp) : (i > 0 ? cps[i - 1] : 0));
        if (i < history.length) replay.move(history[i]);
      }
      const evals: MoveEval[] = history.map((mv, i) => ({
        san: mv.san,
        color: mv.color,
        cpBefore: cps[i],
        cpAfter: cps[i + 1] ?? cps[i],
        loss: Math.max(0, mv.color === 'w' ? cps[i] - cps[i + 1] : cps[i + 1] - cps[i]),
      }));
      setAnalysis(evals);
    } finally {
      setAnalyzing(false);
    }
  };

  // ---------- Écran de configuration ----------
  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Nouvelle partie contre Stockfish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">Niveau du moteur</span>
                <Badge variant="secondary">Niveau {level}/10</Badge>
              </div>
              <Slider value={[level]} min={1} max={10} step={1} onValueChange={([v]) => setLevel(v)} />
              <p className="text-xs text-zinc-500 mt-2">
                {level <= 3 ? 'Débutant : le moteur fait parfois des erreurs.' :
                 level <= 6 ? 'Intermédiaire : jeu solide avec quelques imprécisions.' :
                 level <= 8 ? 'Fort club : très peu d\'erreurs.' : 'Quasi imbattable. Bon courage !'}
              </p>
            </div>
            <div>
              <span className="text-sm text-zinc-400 block mb-2">Vos pièces</span>
              <div className="flex gap-2">
                <Button variant={playerColor === 'w' ? 'default' : 'outline'} className="flex-1" onClick={() => setPlayerColor('w')}>
                  ♔ Blancs
                </Button>
                <Button variant={playerColor === 'b' ? 'default' : 'outline'} className="flex-1" onClick={() => setPlayerColor('b')}>
                  ♚ Noirs
                </Button>
              </div>
            </div>
            <Button onClick={startGame} className="w-full bg-emerald-600 hover:bg-emerald-500" size="lg">
              Commencer la partie
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Échiquier + panneau latéral ----------
  const history = game.history();
  const pairs: string[][] = [];
  for (let i = 0; i < history.length; i += 2) pairs.push(history.slice(i, i + 2));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="mx-auto w-full max-w-[560px]">
        <Board
          game={game}
          orientation={playerColor === 'w' ? 'white' : 'black'}
          interactive={phase === 'playing' && !engineThinking}
          onMove={onMove}
          lastMove={lastMove}
        />
        {engineError && <p className="text-red-400 text-sm mt-3">{engineError}</p>}
      </div>

      <div className="space-y-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Stockfish — niveau {level}</span>
              {engineThinking && <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {phase === 'over' && endInfo && (
              <div className={`rounded-md p-3 mb-3 text-center font-semibold ${
                endInfo.result === 'win' ? 'bg-emerald-600/20 text-emerald-300' :
                endInfo.result === 'loss' ? 'bg-red-600/20 text-red-300' : 'bg-zinc-700/40 text-zinc-300'
              }`}>
                {endInfo.result === 'win' ? '🏆 Victoire !' : endInfo.result === 'loss' ? 'Défaite' : 'Partie nulle'} — {endInfo.reason}
              </div>
            )}
            <ScrollArea className="h-64 rounded border border-zinc-800 p-2">
              <table className="w-full text-sm font-mono">
                <tbody>
                  {pairs.map((pair, i) => (
                    <tr key={i} className="odd:bg-zinc-800/40">
                      <td className="px-2 py-0.5 text-zinc-500 w-8">{i + 1}.</td>
                      <td className="px-2 py-0.5">{pair[0]}</td>
                      <td className="px-2 py-0.5">{pair[1] ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            <div className="flex flex-wrap gap-2 mt-3">
              {phase === 'playing' && (
                <Button variant="outline" size="sm" onClick={resign}>
                  <Flag className="h-4 w-4 mr-1" /> Abandonner
                </Button>
              )}
              {phase === 'over' && (
                <>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => setPhase('setup')}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Rejouer
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadPgn}>
                    <Download className="h-4 w-4 mr-1" /> PGN
                  </Button>
                  <Button variant="outline" size="sm" onClick={analyzeGame} disabled={analyzing}>
                    {analyzing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                    Analyser
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {analysis && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Analyse rapide</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const mine = analysis.filter((a) => a.color === playerColor);
                const blunders = mine.filter((a) => a.loss > 250);
                const mistakes = mine.filter((a) => a.loss > 120 && a.loss <= 250);
                const avgLoss = mine.length ? Math.round(mine.reduce((s, a) => s + a.loss, 0) / mine.length) : 0;
                return (
                  <div className="space-y-2 text-sm">
                    <p>Perte moyenne par coup : <strong>{avgLoss} cp</strong></p>
                    <p>Gaffes (&gt;250 cp) : <strong className="text-red-400">{blunders.length}</strong> · Erreurs : <strong className="text-amber-400">{mistakes.length}</strong></p>
                    {blunders.length > 0 && (
                      <div className="text-zinc-400">
                        <p className="font-medium text-zinc-300 mb-1">Coups à revoir :</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {blunders.slice(0, 6).map((b, i) => (
                            <li key={i}>{b.san} <span className="text-red-400">(−{b.loss} cp)</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
