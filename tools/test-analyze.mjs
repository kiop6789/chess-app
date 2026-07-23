import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { Chess } from 'chess.js';

const ENGINE = join(process.cwd(), 'node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js');
const PGN = `1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

const proc = spawn('node', [ENGINE], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '', resolver = null, lastScore = null;
proc.stdout.on('data', (d) => {
  buf += d;
  const lines = buf.split('\n'); buf = lines.pop();
  for (const l of lines) {
    const m = l.match(/depth (\d+) .*multipv 1 .*score (cp|mate) (-?\d+).*? pv (\S+)/);
    if (m) lastScore = { cp: m[2] === 'mate' ? (m[3] > 0 ? 100000 - +m[3] : -100000 - +m[3]) : +m[3], move: m[4] };
    if (l.startsWith('bestmove') && resolver) { const r = resolver; resolver = null; r(lastScore); }
  }
});
const send = (c) => proc.stdin.write(c + '\n');
const analyze = (fen, mt) => new Promise((res) => { lastScore = null; resolver = res; send(`position fen ${fen}`); send(`go movetime ${mt}`); });
send('uci');
await new Promise((r) => setTimeout(r, 400));

const g = new Chess();
g.loadPgn(PGN);
const history = g.history({ verbose: true });
const replay = new Chess();
const cps = [];
for (let i = 0; i <= history.length; i++) {
  const c = replay.isGameOver() ? null : await analyze(replay.fen(), 180);
  cps.push(c ? (replay.turn() === 'w' ? c.cp : -c.cp) : (i > 0 ? cps[i-1] : 0));
  if (i < history.length) replay.move(history[i]);
}
let blunders = 0;
history.forEach((mv, i) => {
  const loss = Math.max(0, mv.color === 'w' ? cps[i] - cps[i+1] : cps[i+1] - cps[i]);
  if (loss > 250) { blunders++; console.log(`${mv.color === 'w' ? 'B' : 'N'} ${mv.san} -> perte ${Math.round(loss)}cp`); }
});
console.log(`Analyse corrigée OK: ${history.length} coups, ${blunders} gaffes détectées`);
proc.kill();
