import { NavLink, Outlet } from 'react-router';
import { Crown, Swords, Puzzle, GraduationCap, BarChart3, Home, Brain, Map, BookOpen, Hourglass, Search, Menu, Flame } from 'lucide-react';
import { FEATURES } from '@/config/features';
import { useProgress } from '@/lib/storage';
import { currentStreak } from '@/lib/rating';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface NavItem { to: string; label: string; icon: React.ComponentType<{ className?: string }>; }

const mainLinks: NavItem[] = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/jouer', label: 'Jouer', icon: Swords },
  ...(FEATURES.puzzles ? [{ to: '/puzzles', label: 'Puzzles', icon: Brain }] : []),
  { to: '/exercices', label: 'Exercices', icon: Puzzle },
  ...(FEATURES.parcours ? [{ to: '/parcours', label: 'Parcours', icon: Map }] : []),
  { to: '/lecons', label: 'Leçons', icon: GraduationCap },
];

const moreLinks: NavItem[] = [
  ...(FEATURES.finales ? [{ to: '/finales', label: 'Finales', icon: Hourglass }] : []),
  ...(FEATURES.ouvertures ? [{ to: '/ouvertures', label: 'Ouvertures', icon: BookOpen }] : []),
  ...(FEATURES.analyse ? [{ to: '/analyser', label: 'Analyser', icon: Search }] : []),
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
    isActive ? 'bg-emerald-600/20 text-emerald-300' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
  }`;

export function Layout() {
  const { progress } = useProgress();
  const streak = currentStreak(progress.activityDays);

  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 flex items-center gap-4 h-14">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
            <Crown className="h-6 w-6 text-amber-400" />
            <span className="hidden md:inline">Maîtrise des Échecs</span>
          </NavLink>
          <nav className="flex items-center gap-1 ml-auto overflow-x-auto">
            {mainLinks.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
                <Icon className="h-4 w-4" />
                <span className="hidden lg:inline">{label}</span>
              </NavLink>
            ))}
            {moreLinks.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100 gap-1.5">
                    <Menu className="h-4 w-4" />
                    <span className="hidden lg:inline">Plus</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {moreLinks.map(({ to, label, icon: Icon }) => (
                    <DropdownMenuItem key={to} asChild>
                      <NavLink to={to} className="flex items-center gap-2 cursor-pointer">
                        <Icon className="h-4 w-4" /> {label}
                      </NavLink>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem asChild>
                    <NavLink to="/progression" className="flex items-center gap-2 cursor-pointer">
                      <BarChart3 className="h-4 w-4" /> Progression
                    </NavLink>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <NavLink to="/progression" className={linkClass} title="Progression">
              <BarChart3 className="h-4 w-4" />
            </NavLink>
            {streak > 0 && (
              <span className="flex items-center gap-1 text-amber-400 text-sm font-semibold px-2" title={`${streak} jour(s) d'activité consécutifs`}>
                <Flame className="h-4 w-4" /> {streak}
              </span>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
