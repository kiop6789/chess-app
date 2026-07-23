import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Swords, Puzzle, GraduationCap, BarChart3, Clock, Brain, Map, Hourglass, BookOpen, Search, Flame, TrendingUp } from 'lucide-react';
import { useProgress, dueCount } from '@/lib/storage';
import { currentStreak } from '@/lib/rating';
import { EXERCISES, LESSONS } from '@/lib/data';
import { FEATURES } from '@/config/features';

export function HomePage() {
  const { progress } = useProgress();
  const allIds = EXERCISES.map((e) => e.id);
  const due = dueCount(progress, allIds);
  const doneCount = Object.values(progress.exercises).filter((p) => p.successes > 0).length;
  const streak = currentStreak(progress.activityDays);
  const puzzlesSolved = Object.values(progress.puzzles).reduce((s, p) => s + p.successes, 0);

  return (
    <div className="space-y-8">
      <section className="text-center py-10">
        <h1 className="text-4xl font-bold tracking-tight">
          Progressez aux échecs, <span className="text-emerald-400">coup après coup</span>
        </h1>
        <p className="mt-3 text-zinc-400 max-w-2xl mx-auto">
          De débutant à 2000 Elo : 4 600 puzzles vérifiés, parcours structurés, finales interactives,
          ouvertures expliquées et analyse de vos parties par Stockfish.
        </p>
        <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
          {streak > 0 && (
            <Badge variant="secondary" className="gap-1 text-amber-300 text-sm px-3 py-1">
              <Flame className="h-4 w-4" /> {streak} jour{streak > 1 ? 's' : ''} d'affilée
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1 text-emerald-300 text-sm px-3 py-1">
            <TrendingUp className="h-4 w-4" /> Rating puzzles : {progress.puzzleRating}
          </Badge>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {puzzlesSolved} puzzles résolus
          </Badge>
        </div>
      </section>

      {due > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="h-5 w-5 text-amber-400" />
            <p className="text-sm">
              <strong>{due} exercice{due > 1 ? 's' : ''}</strong> à réviser aujourd'hui (répétition espacée).
            </p>
            <Button asChild size="sm" className="ml-auto bg-amber-500 text-zinc-950 hover:bg-amber-400">
              <Link to="/exercices">Réviser</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.parcours && (
          <Card className="bg-gradient-to-br from-emerald-900/40 to-zinc-900 border-emerald-700/40 hover:border-emerald-500/60 transition-colors">
            <CardHeader>
              <Map className="h-8 w-8 text-emerald-400" />
              <CardTitle>Parcours guidés</CardTitle>
              <CardDescription>4 parcours structurés de 800 à 2000+ Elo, couvrant les 5 piliers du jeu.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-500">
                <Link to="/parcours">Suivre mon parcours</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {FEATURES.puzzles && (
          <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-colors">
            <CardHeader>
              <Brain className="h-8 w-8 text-sky-400" />
              <CardTitle>Puzzles</CardTitle>
              <CardDescription>4 600 puzzles Lichess classés par thème et difficulté, mode adaptatif et Woodpecker.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Button asChild className="flex-1 bg-sky-600 hover:bg-sky-500">
                  <Link to="/puzzles">S'entraîner</Link>
                </Button>
                <Badge variant="secondary">{progress.puzzleRating}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-colors">
          <CardHeader>
            <Swords className="h-8 w-8 text-emerald-400" />
            <CardTitle>Jouer contre l'IA</CardTitle>
            <CardDescription>Stockfish, 10 niveaux de difficulté, export PGN et analyse.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-500">
              <Link to="/jouer">Nouvelle partie</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-colors">
          <CardHeader>
            <Puzzle className="h-8 w-8 text-sky-400" />
            <CardTitle>Exercices guidés</CardTitle>
            <CardDescription>{EXERCISES.length} exercices pédagogiques avec indices, explications et répétition espacée.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Button asChild className="flex-1 bg-sky-600 hover:bg-sky-500">
                <Link to="/exercices">S'exercer</Link>
              </Button>
              <Badge variant="secondary">{doneCount}/{EXERCISES.length}</Badge>
            </div>
          </CardContent>
        </Card>

        {FEATURES.finales && (
          <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-colors">
            <CardHeader>
              <Hourglass className="h-8 w-8 text-amber-400" />
              <CardTitle>Finales interactives</CardTitle>
              <CardDescription>Convertissez les finales classiques contre Stockfish qui défend au maximum.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Button asChild className="flex-1 bg-amber-600 hover:bg-amber-500 text-zinc-950">
                  <Link to="/finales">S'entraîner</Link>
                </Button>
                <Badge variant="secondary">{progress.endgamesCompleted.length}/8</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {FEATURES.ouvertures && (
          <Card className="bg-zinc-900 border-zinc-800 hover:border-violet-500/50 transition-colors">
            <CardHeader>
              <BookOpen className="h-8 w-8 text-violet-400" />
              <CardTitle>Ouvertures</CardTitle>
              <CardDescription>Répertoires e4 et d4 avec les plans typiques de chaque variante.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-violet-600 hover:bg-violet-500">
                <Link to="/ouvertures">Explorer</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="bg-zinc-900 border-zinc-800 hover:border-violet-500/50 transition-colors">
          <CardHeader>
            <GraduationCap className="h-8 w-8 text-violet-400" />
            <CardTitle>Leçons</CardTitle>
            <CardDescription>{LESSONS.length} leçons : ouvertures, tactique, finales et stratégie.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Button asChild className="flex-1 bg-violet-600 hover:bg-violet-500">
                <Link to="/lecons">Apprendre</Link>
              </Button>
              <Badge variant="secondary">{progress.lessonsCompleted.length}/{LESSONS.length}</Badge>
            </div>
          </CardContent>
        </Card>

        {FEATURES.analyse && (
          <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-colors">
            <CardHeader>
              <Search className="h-8 w-8 text-rose-400" />
              <CardTitle>Analyse de parties</CardTitle>
              <CardDescription>Importez votre PGN : Stockfish identifie gaffes, erreurs et meilleurs coups.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-rose-600 hover:bg-rose-500">
                <Link to="/analyser">Analyser</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 transition-colors">
          <CardHeader>
            <BarChart3 className="h-8 w-8 text-amber-400" />
            <CardTitle>Progression</CardTitle>
            <CardDescription>Rating, statistiques par thème, séries, historique des parties.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-amber-600 hover:bg-amber-500 text-zinc-950">
              <Link to="/progression">Voir mes stats</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
