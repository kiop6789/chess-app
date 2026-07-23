// Valide les puzzles Lichess importés : FEN légal, coups rejouables,
// et le dernier coup doit être un coup du joueur (nombre pair de demi-coups).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src/data/puzzles');
const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));

let total = 0, kept = 0;
const errors = [];

for (const band of index.bands) {
  const puzzles = JSON.parse(readFileSync(join(DIR, band.file), 'utf8'));
  const valid = [];
  for (const [id, fen, movesStr, rating, mask] of puzzles) {
    total++;
    const moves = movesStr.split(' ');
    if (moves.length < 2 || moves.length % 2 !== 0) { errors.push(`${id}: nombre de coups impair (${moves.length})`); continue; }
    try {
      const g = new Chess(fen);
      for (const uci of moves) {
        const mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        if (!mv) throw new Error(`coup illégal ${uci}`);
      }
      if (!g.isGameOver() && moves.length === 2) { /* mat en 1 sans mat ? acceptable si partie non finie */ }
      valid.push([id, fen, movesStr, rating, mask]);
    } catch (e) {
      errors.push(`${id}: ${e.message}`);
    }
  }
  kept += valid.length;
  writeFileSync(join(DIR, band.file), JSON.stringify(valid));
  band.count = valid.length;
  console.log(`bande ${band.min}-${band.max ?? '+'}: ${valid.length}/${puzzles.length} valides`);
}

writeFileSync(join(DIR, 'index.json'), JSON.stringify(index, null, 2));
console.log(`\n${kept}/${total} puzzles conservés, ${errors.length} rejetés`);
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
