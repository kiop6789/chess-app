// Analyse brute (depth 18, une ligne) des positions problématiques
import { spawn } from 'node:child_process';

const FENS = [
  ['decouverte-0001', '3q2k1/6pp/8/3N4/8/8/8/3R2K1 w - - 0 1'],
  ['decouverte-0003', 'r2qk3/8/8/3N4/8/8/8/3R2K1 w - - 0 1'],
  ['fin-dames-NEW', 'k7/8/1K6/1Q6/8/8/8/8 w - - 0 1'],
  ['fin-tours-0001-NEW', '6k1/8/6K1/8/8/8/8/R7 w - - 0 1'],
  ['ouv-traps-0001', 'rnbqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1'],
  ['ouv-traps-0003', 'rnbqkbnr/pppp1ppp/2n5/8/3NP2q/8/PPP2PPP/RNBQKB1R w KQkq - 0 1'],
  ['sacrifice-0005-legal', 'r1bqkbnr/ppp2ppp/2np4/4p2b/2B1P3/2N2N1P/PPPP1PP1/R1BQK2R w KQkq - 0 1'],
  ['sacrifice-0006-philidor', '5rk1/6pp/8/6N1/8/8/8/3Q2K1 w - - 0 1'],
  ['sacrifice-0007-grec', 'r1b3k1/p4ppp/8/8/8/3B1N2/PP6/3Q2K1 w - - 0 1'],
  ['fourchette-0004-NEW', '4k2r/8/8/8/1n6/8/3P4/Q3K3 w - - 0 1'],
  ['clouage-0004-NEW', 'r1bqk2r/pp1p1ppp/5n2/6B1/4P3/8/PPPP1PPP/RN1QK2R w KQkq - 0 1'],
  ['zwischenzug-NEW', 'r1bqk2r/pppp1ppp/2n2n2/8/2BPn3/2b5/PP3PPP/R1BQ1RK1 w kq - 0 1'],
  ['ouv-traps-0002-NEW', 'r1bqkb1r/ppp2kpp/5n2/3n4/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 1'],
];

const proc = spawn('node', ['/mnt/agents/output/app/node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js'], { stdio: 'pipe' });
let buf = '';
const waiters = [];
proc.stdout.on('data', (d) => {
  buf += d.toString();
  for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i](buf)) waiters.splice(i, 1);
});
const send = (s) => proc.stdin.write(s + '\n');
const waitFor = (pred) => new Promise((res) => waiters.push((b) => (pred(b) ? (res(b), true) : false)));

send('uci');
await waitFor((b) => b.includes('uciok'));
send('setoption name MultiPV value 2');
send('isready');
await waitFor((b) => b.includes('readyok'));

for (const [name, fen] of FENS) {
  const start = buf.length;
  send('ucinewgame');
  send(`position fen ${fen}`);
  send('go depth 18');
  await waitFor((b) => b.slice(start).includes('bestmove'));
  const chunk = buf.slice(start);
  const err = chunk.match(/info string(.*)/);
  const infos = [...chunk.matchAll(/info depth (\d+).*score (cp|mate) (-?\d+).* pv (.+)/g)];
  const last = infos[infos.length - 1];
  const best = chunk.match(/bestmove (\S+)/);
  console.log(
    `\n### ${name}\n` +
    (err ? `ERR:${err[1].trim()} | ` : '') +
    (last ? `depth ${last[1]} score ${last[2]} ${last[3]} pv ${last[4].split(' ').slice(0, 8).join(' ')}` : 'NO INFO') +
    ` | best ${best ? best[1] : '?'}`
  );
}
proc.kill();
process.exit(0);
