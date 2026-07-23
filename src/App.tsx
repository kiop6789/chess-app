import { Route, Routes } from 'react-router';
import { Layout } from '@/components/Layout';
import { HomePage } from '@/pages/HomePage';
import { PlayPage } from '@/pages/PlayPage';
import { ExercisesPage } from '@/pages/ExercisesPage';
import { LessonsPage } from '@/pages/LessonsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PuzzlesPage } from '@/pages/PuzzlesPage';
import { PathsPage } from '@/pages/PathsPage';
import { EndgamesPage } from '@/pages/EndgamesPage';
import { OpeningsPage } from '@/pages/OpeningsPage';
import { AnalyzePage } from '@/pages/AnalyzePage';
import { FEATURES } from '@/config/features';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/jouer" element={<PlayPage />} />
        <Route path="/exercices" element={<ExercisesPage />} />
        <Route path="/lecons" element={<LessonsPage />} />
        <Route path="/progression" element={<DashboardPage />} />
        {FEATURES.puzzles && <Route path="/puzzles" element={<PuzzlesPage />} />}
        {FEATURES.parcours && <Route path="/parcours" element={<PathsPage />} />}
        {FEATURES.finales && <Route path="/finales" element={<EndgamesPage />} />}
        {FEATURES.ouvertures && <Route path="/ouvertures" element={<OpeningsPage />} />}
        {FEATURES.analyse && <Route path="/analyser" element={<AnalyzePage />} />}
      </Route>
    </Routes>
  );
}
