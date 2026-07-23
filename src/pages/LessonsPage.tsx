import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { LESSONS } from '@/lib/data';
import { useProgress } from '@/lib/storage';
import type { Lesson } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  ouvertures: 'Ouvertures',
  tactiques: 'Tactiques',
  finales: 'Finales',
  strategie: 'Stratégie',
};

export function LessonsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { progress, completeLesson } = useProgress();
  const lesson = LESSONS.find((l) => l.id === selectedId) ?? null;

  if (lesson) {
    return (
      <LessonView
        lesson={lesson}
        completed={progress.lessonsCompleted.includes(lesson.id)}
        onComplete={() => completeLesson(lesson.id)}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leçons de théorie</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {LESSONS.map((l) => {
          const done = progress.lessonsCompleted.includes(l.id);
          return (
            <Card key={l.id} className="bg-zinc-900 border-zinc-800 hover:border-violet-500/50 transition-colors flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{CATEGORY_LABELS[l.category]}</Badge>
                  {done && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                </div>
                <CardTitle className="text-lg">{l.title}</CardTitle>
                <CardDescription>{l.intro}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <GraduationCap className="h-4 w-4" />
                  <span>{l.level} · {l.sections.length} sections</span>
                </div>
                <Button onClick={() => setSelectedId(l.id)} className="w-full bg-violet-600 hover:bg-violet-500">
                  {done ? 'Relire' : 'Commencer'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function LessonView({ lesson, completed, onComplete, onBack }: {
  lesson: Lesson;
  completed: boolean;
  onComplete: () => void;
  onBack: () => void;
}) {
  const [section, setSection] = useState(0);
  const sec = lesson.sections[section];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Toutes les leçons
        </Button>
        <h1 className="text-xl font-bold">{lesson.title}</h1>
        <Badge variant="secondary" className="ml-auto">Section {section + 1}/{lesson.sections.length}</Badge>
      </div>

      <div className={`grid gap-6 items-start ${sec.fen ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}`}>
        {sec.fen && <SectionBoard fen={sec.fen} moves={sec.moves} />}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">{sec.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-300 leading-relaxed whitespace-pre-line">{sec.text}</p>
            {sec.moves && (
              <p className="mt-3 text-sm font-mono text-emerald-300 bg-zinc-800/60 rounded p-2">
                {sec.moves.join(' ')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setSection((s) => Math.max(0, s - 1))} disabled={section === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
        </Button>
        {section < lesson.sections.length - 1 ? (
          <Button onClick={() => setSection((s) => s + 1)} className="bg-violet-600 hover:bg-violet-500">
            Suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={onComplete} disabled={completed} className="bg-emerald-600 hover:bg-emerald-500">
            {completed ? 'Leçon terminée ✓' : 'Marquer comme terminée'}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Diagramme interactif : rejoue la séquence de coups de la section. */
function SectionBoard({ fen, moves }: { fen: string; moves?: string[] }) {
  const [ply, setPly] = useState(0);

  const { game, played } = useMemo(() => {
    const g = new Chess(fen);
    const sans: string[] = [];
    if (moves) {
      for (let i = 0; i < ply && i < moves.length; i++) {
        const mv = g.move(moves[i].replace(/[+#!?]+$/, '')) ?? g.move(moves[i]);
        if (mv) sans.push(mv.san); else break;
      }
    }
    return { game: g, played: sans };
  }, [fen, moves, ply]);

  // Diagramme statique → toujours côté Blancs ; séquence → côté du joueur au trait.
  const orientation = !moves || moves.length === 0
    ? 'white'
    : (fen.split(' ')[1] === 'w' ? 'white' : 'black');

  return (
    <div className="space-y-2">
      <Board game={game} orientation={orientation} interactive={false} />
      {moves && moves.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPly(0)} disabled={ply === 0}>⏮</Button>
          <Button variant="outline" size="sm" onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-zinc-400 font-mono flex-1 text-center">
            {ply}/{moves.length}{played.length > 0 ? ` — ${played[played.length - 1]}` : ''}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPly((p) => Math.min(moves.length, p + 1))} disabled={ply >= moves.length}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPly(moves.length)} disabled={ply >= moves.length}>⏭</Button>
        </div>
      )}
    </div>
  );
}
