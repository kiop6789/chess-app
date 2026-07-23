// Validation du contenu pédagogique :
//  1. FEN valides + solutions légales (chess.js), SAN canoniques régénérés
//  2. Qualité des solutions vérifiée par Stockfish (MultiPV 3)
//  3. Écrit les JSON dans src/data/ si tout passe
// Usage : node tools/validate-data.mjs [--engine-only | --no-engine]

import { Chess } from 'chess.js';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXERCISES, EXERCISES_EXTRA, LESSONS, LESSONS_STRATEGY } from './content-data.mjs';

const ALL_LESSONS = [...LESSONS, ...(LESSONS_STRATEGY ?? [])];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE_JS = join(ROOT, 'node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js');
const NO_ENGINE = process.argv.includes('--no-engine');
const ALL_EXERCISES = [...EXERCISES, ...EXERCISES_EXTRA];

// ---------- Moteur UCI minimal ----------
function createEngine() {
  const proc = spawn('node', [ENGINE_JS], { stdio: 'pipe' });
  let buf = '';
  let waiters = [];
  proc.stdout.on('data', (d) => {
    buf += d.toString();
    waiters = waiters.filter((w) => !w(buf));
  });
  const send = (s) => proc.stdin.write(s + '\n');
  const waitFor = (pred) =>
    new Promise((resolve) => {
      if (pred(buf)) return resolve(buf);
      waiters.push((b) => (pred(b) ? (resolve(b), true) : false));
    });
  const ready = (async () => {
    send('uci');
    await waitFor((b) => b.includes('uciok'));
    send('setoption name MultiPV value 3');
    send('isready');
    await waitFor((b) => b.includes('readyok'));
  })();
  async function analyze(fen, movetimeMs = 800) {
    await ready;
    const startLen = buf.length;
    send('ucinewgame');
    send(`position fen ${fen}`);
    send(`go movetime ${movetimeMs}`);
    await waitFor((b) => b.slice(startLen).includes('bestmove'));
    const chunk = buf.slice(startLen);
    buf = buf.slice(0, startLen) + chunk.slice(chunk.lastIndexOf('bestmove'));
    const lines = chunk.split('\n');
    const cands = new Map();
    for (const l of lines) {
      const m = l.match(/multipv (\d+).*score (cp|mate) (-?\d+).* pv (\S+)/);
      if (m) {
        const [, pv, kind, val, move] = m;
        if (!cands.has(move)) {
          const v = parseInt(val, 10);
          cands.set(move, kind === 'mate' ? (v > 0 ? 100000 - v : -100000 - v) : v);
        }
      }
    }
    const out = [...cands.entries()].map(([move, cp]) => ({ move, cp })).sort((a, b) => b.cp - a.cp);
    if (out.length === 0) { // resync complet + retry
      send('stop');
      send('isready');
      await waitFor((b) => b.includes('readyok'));
      buf = '';
      const startLen2 = 0;
      send(`position fen ${fen}`);
      send(`go movetime ${movetimeMs * 2}`);
      await waitFor((b) => b.slice(startLen2).includes('bestmove'));
      const chunk2 = buf.slice(startLen2);
      buf = buf.slice(0, startLen2) + chunk2.slice(chunk2.lastIndexOf('bestmove'));
      for (const l of chunk2.split('\n')) {
        const m = l.match(/multipv (\d+).*score (cp|mate) (-?\d+).* pv (\S+)/);
        if (m) {
          const v = parseInt(m[3], 10);
          cands.set(m[4], m[2] === 'mate' ? (v > 0 ? 100000 - v : -100000 - v) : v);
        }
      }
      return [...cands.entries()].map(([move, cp]) => ({ move, cp })).sort((a, b) => b.cp - a.cp);
    }
    return out;
  }
  return { analyze, kill: () => proc.kill() };
}

// ---------- Helpers ----------
const toUci = (mv) => mv.from + mv.to + (mv.promotion || '');

function sanityCheckPosition(fen) {
  // chess.js tolère des positions illégales (17 pièces, 3 cavaliers…) que Stockfish refuse.
  const game = new Chess(fen);
  const board = game.board();
  const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0, total: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0, total: 0 } };
  for (const row of board) for (const sq of row) if (sq) { count[sq.color][sq.type]++; count[sq.color].total++; }
  for (const c of ['w', 'b']) {
    const n = count[c], name = c === 'w' ? 'Blancs' : 'Noirs';
    if (n.k !== 1) throw new Error(`position illégale : ${name} ont ${n.k} roi(s)`);
    if (n.total > 16) throw new Error(`position illégale : ${name} ont ${n.total} pièces (>16)`);
    if (n.p > 8) throw new Error(`position illégale : ${name} ont ${n.p} pions (>8)`);
    if (n.n > 2 && n.p + (n.n - 2) > 8) throw new Error(`position illégale : ${name} ont ${n.n} cavaliers (promotions impossibles)`);
    if (n.b > 2 && n.p + (n.b - 2) > 8) throw new Error(`position illégale : ${name} ont ${n.b} fous (promotions impossibles)`);
    if (n.r > 2 && n.p + (n.r - 2) > 8) throw new Error(`position illégale : ${name} ont ${n.r} tours (promotions impossibles)`);
    if (n.q > 1 && n.p + (n.q - 1) > 8) throw new Error(`position illégale : ${name} ont ${n.q} dames (promotions impossibles)`);
  }
  // Rois adjacents = position illégale
  let kw, kb;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = board[r][c];
    if (sq && sq.type === 'k') { const pos = [r, c]; if (sq.color === 'w') kw = pos; else kb = pos; }
  }
  if (kw && kb && Math.abs(kw[0] - kb[0]) <= 1 && Math.abs(kw[1] - kb[1]) <= 1) throw new Error('position illégale : rois adjacents');
  // Le camp qui n'a pas le trait ne peut pas être en échec (Stockfish rejette ces positions)
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-'; // pas de case en passant dans la position inversée
  const flipped = new Chess(parts.join(' '));
  if (flipped.inCheck()) throw new Error('position illégale : le camp sans le trait est en échec');
}

function replaySolution(fen, sanLine) {
  sanityCheckPosition(fen);
  const game = new Chess(fen);
  const canonical = [];
  const positions = [{ fen, turn: game.turn() }];
  for (const raw of sanLine) {
    const clean = raw.replace(/[+#!?]+$/, '');
    let mv = null;
    try { mv = game.move(raw); } catch { try { mv = game.move(clean); } catch { /* */ } }
    if (!mv) throw new Error(`coup illégal « ${raw} » (coups possibles: ${game.moves().slice(0, 12).join(', ')}…)`);
    canonical.push(mv.san);
    positions.push({ fen: game.fen(), turn: game.turn(), uci: toUci(mv) });
  }
  return { canonical, positions };
}

const mateIn = (cp) => (Math.abs(cp) > 90000 ? Math.max(1, 100000 - Math.abs(cp)) : null);

// ---------- Validation principale ----------
const engine = NO_ENGINE ? null : createEngine();
const problems = [];
const validated = [];

for (const ex of ALL_EXERCISES) {
  const label = `${ex.id} (${ex.difficulty})`;
  let replay;
  try {
    replay = replaySolution(ex.fen, ex.solution);
  } catch (e) {
    problems.push(`❌ ${label}: ${e.message}`);
    continue;
  }
  ex.solution = replay.canonical;

  if (!engine) { validated.push(ex); continue; }

  // 1) Le coup solution doit être ~le meilleur (MultiPV 3, tolérance 120cp)
  // En cas de rejet, re-analyse approfondie (2500 ms) avant de conclure.
  const userMoveUci = replay.positions[1].uci;
  let cands = await engine.analyze(ex.fen);
  let best = cands[0];
  if (!best) { problems.push(`⚠️  ${label}: moteur sans analyse pour cette position`); continue; }
  let mine = cands.find((c) => c.move === userMoveUci);
  let gap = mine ? best.cp - mine.cp : Infinity;
  let bothMate = mateIn(best.cp) && mine && mateIn(mine.cp) && mateIn(mine.cp) <= mateIn(best.cp) + 1;
  if (!mine || (gap > 120 && !bothMate)) {
    const deep = await engine.analyze(ex.fen, 3500);
    if (deep[0]) {
      cands = deep; best = deep[0];
      mine = cands.find((c) => c.move === userMoveUci);
      gap = mine ? best.cp - mine.cp : Infinity;
      bothMate = mateIn(best.cp) && mine && mateIn(mine.cp) && mateIn(mine.cp) <= mateIn(best.cp) + 1;
    }
  }
  if (!mine) {
    problems.push(`⚠️  ${label}: solution ${ex.solution[0]} (${userMoveUci}) absente du top5 moteur [${cands.map(c=>`${c.move}:${c.cp}`).join(' ')}]`);
    continue;
  } else if (gap > 120 && !bothMate) {
    problems.push(`⚠️  ${label}: solution ${ex.solution[0]} sous-optimale (−${gap}cp) [best ${best.move}:${best.cp}]`);
    continue;
  }

  // 2) Les réponses adverses doivent être plausibles (tolérance 400cp, ou mat proche)
  let warn = '';
  for (let i = 1; i < ex.solution.length; i += 2) {
    const posBefore = replay.positions[i];
    const oppUci = replay.positions[i + 1].uci;
    const cc = await engine.analyze(posBefore.fen, 500);
    const b = cc[0];
    const o = cc.find((c) => c.move === oppUci);
    const g = o ? b.cp - o.cp : Infinity;
    const mateOk = mateIn(b.cp) !== null && o && mateIn(o.cp) !== null;
    if (g > 400 && !mateOk) warn += ` | réponse ${ex.solution[i]} discutable (−${g === Infinity ? '?' : g}cp vs ${b.move})`;
  }
  validated.push(ex);
  console.log(`✅ ${label}: ${ex.solution.join(' ')}${warn ? '  ⚠️' + warn : ''}`);
}

// ---------- Validation des leçons ----------
for (const lesson of ALL_LESSONS) {
  for (const [si, sec] of lesson.sections.entries()) {
    try {
      if (sec.fen) {
        sanityCheckPosition(sec.fen);
        new Chess(sec.fen);
      }
      if (sec.moves) {
        if (!sec.fen) throw new Error('section avec moves mais sans fen de départ');
        const g = new Chess(sec.fen);
        for (const [mi, raw] of sec.moves.entries()) {
          const clean = raw.replace(/[+#!?]+$/, '');
          let mv = null;
          try { mv = g.move(raw); } catch { try { mv = g.move(clean); } catch { /* */ } }
          if (!mv) throw new Error(`coup illégal « ${raw} » (coups possibles: ${g.moves().slice(0, 12).join(', ')}…)`);
          sec.moves[mi] = mv.san;
        }
      }
    } catch (e) {
      problems.push(`❌ leçon ${lesson.id} section ${si} (${sec.heading || '?'}): ${e.message}`);
    }
  }
  console.log(`✅ leçon ${lesson.id}: ${lesson.sections.length} sections`);
}

// ---------- Écriture ----------
if (problems.length) {
  console.log('\nPROBLÈMES:\n' + problems.join('\n'));
  process.exit(1);
}

const byTheme = {};
for (const ex of validated) (byTheme[ex.theme] ??= []).push(ex);
const exDir = join(ROOT, 'src/data/exercises');
mkdirSync(exDir, { recursive: true });
const themeFile = { tactique: 'tactiques', finale: 'finales', ouverture: 'ouvertures' };
for (const [theme, list] of Object.entries(byTheme)) {
  writeFileSync(join(exDir, `${themeFile[theme]}.json`), JSON.stringify(list, null, 2));
}
writeFileSync(join(exDir, 'index.json'), JSON.stringify({
  themes: Object.entries(byTheme).map(([theme, list]) => ({ theme, file: `${themeFile[theme]}.json`, count: list.length })),
}, null, 2));

const lsDir = join(ROOT, 'src/data/lessons');
const lsIndex = [];
for (const lesson of ALL_LESSONS) {
  const dir = join(lsDir, lesson.category);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${lesson.id}.json`), JSON.stringify(lesson, null, 2));
  lsIndex.push({ id: lesson.id, file: `${lesson.category}/${lesson.id}.json`, category: lesson.category, title: lesson.title, level: lesson.level, intro: lesson.intro, sectionCount: lesson.sections.length });
}
writeFileSync(join(lsDir, 'index.json'), JSON.stringify(lsIndex, null, 2));

console.log(`\n✨ ${validated.length} exercices + ${ALL_LESSONS.length} leçons écrits dans src/data/`);
if (engine) engine.kill();
process.exit(0);
