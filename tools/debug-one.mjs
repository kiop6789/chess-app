// Teste une liste de FEN, chacun dans un processus moteur FRAIS.
// Affiche : display board, meilleur coup + score (MultiPV 3), ou erreur/crash.
import { spawn } from 'node:child_process';

const ENGINE = '/mnt/agents/output/app/node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js';
const FENS = [
  ['ouv-traps-0001', 'rnbqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1'],
  ['ouv-traps-0003', 'rnbqkbnr/pppp1ppp/2n5/8/3NP2q/8/PPP2PPP/RNBQKB1R w KQkq - 0 1'],
  ['sacrifice-0005-legal', 'r1bqkbnr/ppp2ppp/2np4/4p2b/2B1P3/2N2N1P/PPPP1PP1/R1BQK2R w KQkq - 0 1'],
  ['ouv-traps-0002-NEW', 'r1bqkb1r/ppp2kpp/5n2/3n4/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 1'],
  ['clouage-0004-NEW', 'r1bqk2r/pp1p1ppp/5n2/6B1/4P3/8/PPPP1PPP/RN1QK2R w KQkq - 0 1'],
  ['fourchette-0004-v3', 'r3k3/8/8/8/1n6/8/3P4/3QK3 w - - 0 1'],
  ['decouverte-0001-v2', '3q2k1/4p1pp/8/3N4/8/8/8/3R2K1 w - - 0 1'],
  ['decouverte-0003-v2', '4q1k1/6pp/8/8/4N3/8/8/4R1K1 w - - 0 1'],
  ['sacrifice-0007-v2', '5rk1/5ppp/8/8/8/3B1N2/PPP5/3Q2K1 w - - 0 1'],
];

function testOne(name, fen) {
  return new Promise((resolve) => {
    const proc = spawn('node', [ENGINE], { stdio: 'pipe' });
    let buf = '';
    let done = false;
    const finish = (msg) => { if (!done) { done = true; console.log(`### ${name}: ${msg}`); proc.kill(); resolve(); } };
    proc.on('exit', (c) => finish(`PROCESS EXIT code=${c}`));
    proc.on('error', (e) => finish(`SPAWN ERROR ${e.message}`));
    proc.stderr.on('data', (d) => { buf += `\n[stderr] ${d.toString().slice(0, 200)}`; });
    proc.stdout.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/bestmove (\S+)/);
      if (m) {
        const infos = [...buf.matchAll(/info depth \d+.*multipv (\d+).*score (cp|mate) (-?\d+).* pv (\S+)/g)];
        const byPv = {};
        for (const i of infos) byPv[i[1]] = `${i[4]}(${i[2]} ${i[3]})`;
        finish(`best ${m[1]} | MPV: ${Object.values(byPv).join(' ')}${buf.includes('ERROR') ? ' | ENGINE-ERR!' : ''}`);
      }
    });
    setTimeout(() => finish('TIMEOUT (pas de bestmove en 25s)'), 25000);
    setTimeout(() => {
      proc.stdin.write('uci\n');
      setTimeout(() => {
        proc.stdin.write('setoption name MultiPV value 3\n');
        proc.stdin.write('isready\n');
        setTimeout(() => {
          proc.stdin.write(`position fen ${fen}\n`);
          proc.stdin.write('go depth 16\n');
        }, 400);
      }, 400);
    }, 300);
  });
}

for (const [n, f] of FENS) await testOne(n, f);
process.exit(0);
