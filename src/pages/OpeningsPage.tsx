import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { OPENINGS } from '@/lib/data';
import type { Opening } from '@/types';

export function OpeningsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const opening = OPENINGS.find((o) => o.id === selectedId) ?? null;

  if (opening) {
    return <OpeningExplorer opening={opening} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bibliothèque d'ouvertures</h1>
        <p className="text-zinc-400 mt-1">
          Des répertoires solides pour les deux couleurs, avec les plans typiques de chaque variante.
          Comprendre les plans vaut mieux que mémoriser les coups.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {OPENINGS.map((o) => (
          <Card key={o.id} className="bg-zinc-900 border-zinc-800 hover:border-violet-500/50 transition-colors flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{o.for}</Badge>
                <Badge variant="secondary">{o.side === 'blancs' ? '♔ Blancs' : '♚ Noirs'}</Badge>
              </div>
              <CardTitle className="text-lg">{o.name}</CardTitle>
              <CardDescription>{o.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between">
              <span className="text-xs text-zinc-500">{o.lines.length} variantes</span>
              <Button size="sm" onClick={() => setSelectedId(o.id)} className="bg-violet-600 hover:bg-violet-500">
                <BookOpen className="h-4 w-4 mr-1" /> Explorer
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OpeningExplorer({ opening, onBack }: { opening: Opening; onBack: () => void }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [ply, setPly] = useState(0);
  const line = opening.lines[lineIdx];

  const { game, sans } = useMemo(() => {
    const g = new Chess();
    const played: string[] = [];
    for (let i = 0; i < ply && i < line.moves.length; i++) {
      const mv = g.move(line.moves[i].replace(/[+#!?]+$/, '')) ?? g.move(line.moves[i]);
      if (mv) played.push(mv.san); else break;
    }
    return { game: g, sans: played };
  }, [line, ply]);

  const selectLine = (i: number) => { setLineIdx(i); setPly(0); };
  const orientation = opening.side === 'blancs' ? 'white' : 'black';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Bibliothèque
        </Button>
        <h1 className="text-xl font-bold">{opening.name}</h1>
        <Badge variant="secondary" className="ml-auto">{opening.side === 'blancs' ? 'Pour les Blancs' : 'Pour les Noirs'}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {opening.lines.map((l, i) => (
          <Button key={i} size="sm" variant={i === lineIdx ? 'default' : 'outline'} onClick={() => selectLine(i)}>
            {l.name}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
        <div className="space-y-2">
          <Board game={game} orientation={orientation} interactive={false} />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPly(0)} disabled={ply === 0}>⏮</Button>
            <Button variant="outline" size="sm" onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-zinc-400 font-mono flex-1 text-center">
              {Math.ceil(ply / 2)}/{Math.ceil(line.moves.length / 2)}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPly((p) => Math.min(line.moves.length, p + 1))} disabled={ply >= line.moves.length}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPly(line.moves.length)} disabled={ply >= line.moves.length}>⏭</Button>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{line.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-mono">
                {(() => {
                  const rows: React.ReactNode[] = [];
                  for (let i = 0; i < sans.length; i += 2) {
                    rows.push(
                      <span key={i}>
                        <span className="text-zinc-500">{i / 2 + 1}.</span>{' '}
                        <span className={i === ply - 1 ? 'text-emerald-300 font-semibold' : ''}>{sans[i]}</span>
                        {sans[i + 1] && (
                          <> <span className={i + 1 === ply - 1 ? 'text-emerald-300 font-semibold' : ''}>{sans[i + 1]}</span></>
                        )}
                      </span>
                    );
                  }
                  return rows;
                })()}
              </div>
              <div className="border-t border-zinc-800 pt-3">
                <p className="text-xs uppercase tracking-wide text-violet-300 font-semibold mb-1">Plan typique</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{line.plan}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="py-3 text-xs text-zinc-500">
              💡 Conseil : jouez la ligne coup par coup, puis cachez les coups et essayez de la retrouver de mémoire en vous expliquant le plan à voix haute.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
