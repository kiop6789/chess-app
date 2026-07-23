import { useCallback, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '@/components/Board';
import { engine } from '@/engine/stockfish';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, AlertTriangle, XCircle, Info } from 'lucide-react';

interface MoveAnalysis {
  san: string;
  color: 'w' | 'b';
  cpAfter: number;      // du point de vue des Blancs
  bestSan: string | null;
  loss: number;         // perte en centipions pour le joueur du coup
}

const SAMPLE_PGN = `[Event "Partie de l'Opéra — Paris, 1858"]
[White "Paul Morphy"]
[Black "Duc de Brunswick & Comte Isouard"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

function classify(loss: number): 'gaffe' | 'erreur' | 'imprécision' | null {
  if (loss > 250) return 'gaffe';
  if (loss > 120) return 'erreur';
  if (loss > 60) return 'imprécision';
  return null;
}

export function AnalyzePage() {
  const [pgn, setPgn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [analysis, setAnalysis] = useState<MoveAnalysis[] | null>(null);
  const [meta, setMeta] = useState<{ white: string; black: string; event: string }>({ white: 'Blancs', black: 'Noirs', event: '' });
  const [cursor, setCursor] = useState(0); // nb de coups joués sur l'échiquier
  const cancelRef = useRef(false);

  const displayGame = useMemo(() => {
    const g = new Chess();
    if (analysis) {
      for (let i = 0; i < cursor && i < analysis.length; i++) g.move(analysis[i].san);
    }
    return g;
  }, [analysis, cursor]);

  const analyze = useCallback(async () => {
    setError(null);
    setAnalysis(null);
    const parsed = new Chess();
    try {
      parsed.loadPgn(pgn.trim() || SAMPLE_PGN);
    } catch (e) {
      setError(`PGN illisible — ${(e as Error).message}`);
      return;
    }
    const history = parsed.history({ verbose: true });
    if (history.length < 4) { setError('La partie est trop courte pour être analysée.'); return; }
    const header = (k: string) => parsed.header()[k] ?? '';
    setMeta({ white: header('White') || 'Blancs', black: header('Black') || 'Noirs', event: header('Event') || '' });

    setAnalyzing(true);
    cancelRef.current = false;
    const replay = new Chess();
    try {
      // Évalue chaque position AVANT le coup (N+1 positions avec la finale) :
      // la perte d'un coup = eval(avant) − eval(après), du point de vue du joueur.
      const evals: number[] = [];
      const bests: (string | null)[] = [];
      const sans: { san: string; color: 'w' | 'b' }[] = history.map((m) => ({ san: m.san, color: m.color }));
      for (let i = 0; i <= history.length; i++) {
        if (cancelRef.current) break;
        const fen = replay.fen();
        const cands = replay.isGameOver() ? [] : await engine.analyze(fen, { movetime: 180, multipv: 1 });
        const cpWhite = cands[0]
          ? (replay.turn() === 'w' ? cands[0].cp : -cands[0].cp)
          : (i > 0 ? evals[i - 1] : 0);
        evals.push(cpWhite);
        let bestSan: string | null = null;
        if (cands[0]) {
          const tmp = new Chess(fen);
          const u = cands[0].move;
          const bm = tmp.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
          bestSan = bm?.san ?? null;
        }
        bests.push(bestSan);
        if (i < history.length) replay.move(history[i]);
        setProgressPct(Math.round(((i + 1) / (history.length + 1)) * 100));
      }
      if (!cancelRef.current) {
        const results: MoveAnalysis[] = sans.map((m, i) => ({
          san: m.san,
          color: m.color,
          cpAfter: evals[i + 1] ?? evals[i],
          bestSan: bests[i],
          loss: Math.max(0, m.color === 'w' ? evals[i] - evals[i + 1] : evals[i + 1] - evals[i]),
        }));
        setAnalysis(results);
        setCursor(results.length);
      }
    } finally {
      setAnalyzing(false);
    }
  }, [pgn]);

  const stats = useMemo(() => {
    if (!analysis) return null;
    const by = (c: 'w' | 'b') => analysis.filter((a) => a.color === c);
    const count = (c: 'w' | 'b', min: number, max = Infinity) => by(c).filter((a) => a.loss > min && a.loss <= max).length;
    return {
      w: { g: count('w', 250), e: count('w', 120, 250), i: count('w', 60, 120), acpl: Math.round(by('w').reduce((s, a) => s + a.loss, 0) / Math.max(1, by('w').length)) },
      b: { g: count('b', 250), e: count('b', 120, 250), i: count('b', 60, 120), acpl: Math.round(by('b').reduce((s, a) => s + a.loss, 0) / Math.max(1, by('b').length)) },
    };
  }, [analysis]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analyse de partie</h1>
        <p className="text-zinc-400 mt-1">
          Importez une partie au format PGN : Stockfish passe chaque position au crible et identifie vos gaffes, erreurs et les meilleurs coups.
        </p>
      </div>

      {!analysis && (
        <Card className="bg-zinc-900 border-zinc-800 max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">Coller un PGN</CardTitle>
            <CardDescription>Laissez vide pour analyser une partie d'exemple.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder={SAMPLE_PGN.slice(0, 200) + '…'}
              className="min-h-40 font-mono text-xs bg-zinc-950"
              disabled={analyzing}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            {analyzing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours… {progressPct}%
                </div>
                <Progress value={progressPct} className="h-2" />
                <Button variant="outline" size="sm" onClick={() => { cancelRef.current = true; }}>
                  Annuler
                </Button>
              </div>
            ) : (
              <Button onClick={analyze} className="bg-emerald-600 hover:bg-emerald-500">
                <Upload className="h-4 w-4 mr-1" /> Analyser la partie
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {analysis && stats && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold">{meta.white} vs {meta.black}</p>
              <p className="text-sm text-zinc-500">{meta.event} · {Math.ceil(analysis.length / 2)} coups</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setAnalysis(null); setCursor(0); }}>
              Nouvelle analyse
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {([['w', meta.white], ['b', meta.black]] as const).map(([c, name]) => (
              <Card key={c} className="bg-zinc-900 border-zinc-800">
                <CardContent className="py-3 flex items-center justify-between">
                  <span className="font-medium">{name}</span>
                  <div className="flex gap-2 text-sm">
                    <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {stats[c].g} gaffe{stats[c].g > 1 ? 's' : ''}</Badge>
                    <Badge variant="secondary" className="gap-1 text-amber-300"><AlertTriangle className="h-3 w-3" /> {stats[c].e}</Badge>
                    <Badge variant="secondary" className="gap-1 text-zinc-400"><Info className="h-3 w-3" /> {stats[c].i}</Badge>
                    <span className="text-zinc-500">ACPL {stats[c].acpl}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <EvalGraph analysis={analysis} cursor={cursor} onSelect={setCursor} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
            <div className="mx-auto w-full max-w-[540px]">
              <Board
                game={displayGame}
                orientation="white"
                interactive={false}
                lastMove={cursor > 0 ? {
                  from: displayGame.history({ verbose: true }).at(-1)?.from ?? '',
                  to: displayGame.history({ verbose: true }).at(-1)?.to ?? '',
                } : null}
              />
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setCursor(0)} disabled={cursor === 0}>⏮</Button>
                <Button variant="outline" size="sm" onClick={() => setCursor((c) => Math.max(0, c - 1))} disabled={cursor === 0}>◀</Button>
                <span className="flex-1 text-center text-sm font-mono text-zinc-400">
                  {cursor === 0 ? 'Position initiale' : `${Math.ceil(cursor / 2)}. ${analysis[cursor - 1].san}`}
                </span>
                <Button variant="outline" size="sm" onClick={() => setCursor((c) => Math.min(analysis.length, c + 1))} disabled={cursor >= analysis.length}>▶</Button>
                <Button variant="outline" size="sm" onClick={() => setCursor(analysis.length)} disabled={cursor >= analysis.length}>⏭</Button>
              </div>
            </div>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Coups annotés</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <table className="w-full text-sm">
                    <tbody>
                      {(() => {
                        const rows: React.ReactNode[] = [];
                        for (let i = 0; i < analysis.length; i += 2) {
                          rows.push(
                            <tr key={i} className="border-b border-zinc-800/40">
                              <td className="py-1.5 pr-2 text-zinc-500 w-8">{i / 2 + 1}.</td>
                              {[analysis[i], analysis[i + 1]].map((a, j) => {
                                if (!a) return <td key={j} />;
                                const idx = i + j;
                                const cls = classify(a.loss);
                                return (
                                  <td key={j} className="py-1.5 pr-2">
                                    <button
                                      onClick={() => setCursor(idx + 1)}
                                      className={`font-mono px-1 rounded hover:bg-zinc-800 ${cursor === idx + 1 ? 'bg-zinc-800 text-emerald-300' : ''} ${
                                        cls === 'gaffe' ? 'text-red-400' : cls === 'erreur' ? 'text-amber-400' : cls === 'imprécision' ? 'text-zinc-400' : ''
                                      }`}
                                    >
                                      {a.san}{cls === 'gaffe' ? '??' : cls === 'erreur' ? '?' : cls === 'imprécision' ? '?!' : ''}
                                    </button>
                                    {cls && a.bestSan && (
                                      <span className="text-xs text-zinc-500 ml-1">({a.bestSan})</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        }
                        return rows;
                      })()}
                    </tbody>
                  </table>
                </ScrollArea>
                <p className="text-xs text-zinc-500 mt-2">?? gaffe · ? erreur · ?! imprécision — entre parenthèses : le meilleur coup.</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/** Graphe d'évaluation (point de vue Blancs), cliquable. */
function EvalGraph({ analysis, cursor, onSelect }: {
  analysis: MoveAnalysis[];
  cursor: number;
  onSelect: (i: number) => void;
}) {
  const W = 720, H = 110, PAD = 6;
  const clamp = (cp: number) => Math.max(-500, Math.min(500, cp));
  const cps = [20, ...analysis.map((a) => a.cpAfter)];
  const points = cps.map((cp, i) => ({
    x: PAD + (i / Math.max(1, analysis.length)) * (W - 2 * PAD),
    y: H / 2 - (clamp(cp) / 500) * (H / 2 - PAD),
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const cursorX = points[Math.min(cursor, points.length - 1)]?.x ?? PAD;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="py-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-crosshair"
          onClick={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * W;
            const idx = Math.round(((x - PAD) / (W - 2 * PAD)) * analysis.length);
            onSelect(Math.max(0, Math.min(analysis.length, idx)));
          }}
        >
          <rect x={0} y={0} width={W} height={H / 2} fill="rgba(255,255,255,0.06)" />
          <rect x={0} y={H / 2} width={W} height={H / 2} fill="rgba(0,0,0,0.35)" />
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#52525b" strokeWidth={1} />
          <path d={path} fill="none" stroke="#34d399" strokeWidth={2} />
          <line x1={cursorX} y1={0} x2={cursorX} y2={H} stroke="#f59e0b" strokeWidth={1.5} />
        </svg>
        <p className="text-xs text-zinc-500 mt-1">Évaluation (haut = avantage Blancs, bas = avantage Noirs). Cliquez pour naviguer.</p>
      </CardContent>
    </Card>
  );
}
