/**
 * Client UCI pour Stockfish (build WASM mono-fil, chargée en Web Worker
 * depuis /engine/stockfish.js — aucun header COOP/COEP requis).
 */

export interface EngineCandidate {
  move: string;      // UCI, ex. « e2e4 »
  cp: number;        // centipions normalisés (mat = ±100000 ∓ distance)
  pv: string[];
  depth: number;
}

interface PendingQuery {
  resolve: (c: EngineCandidate[]) => void;
  candidates: Map<number, EngineCandidate>; // multipv → meilleure ligne
}

const MATE_BASE = 100000;

function normalizeScore(kind: string, v: number): number {
  return kind === 'mate' ? (v > 0 ? MATE_BASE - v : -MATE_BASE - v) : v;
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private pending: PendingQuery | null = null;

  async init(): Promise<void> {
    if (this.worker) return;
    this.worker = new Worker('/engine/stockfish.js');
    this.worker.onmessage = (e: MessageEvent<string>) => this.handleLine(e.data);
    this.worker.onerror = (err) => console.error('Stockfish worker error', err);
    this.send('uci');
    await this.waitFor((l) => l === 'uciok');
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
    this.ready = true;
  }

  private lineHandlers: Array<{ pred: (l: string) => boolean; cb: (l: string) => void }> = [];

  private handleLine(line: string) {
    // Réponses aux requêtes d'analyse en cours
    if (this.pending) {
      const m = line.match(/depth (\d+) .*multipv (\d+) .*score (cp|mate) (-?\d+)(?: .*?)? pv (.+)/);
      if (m) {
        const [, depth, mpv, kind, score, pv] = m;
        this.pending.candidates.set(Number(mpv), {
          move: pv.split(' ')[0],
          cp: normalizeScore(kind, Number(score)),
          pv: pv.split(' '),
          depth: Number(depth),
        });
      }
      if (line.startsWith('bestmove')) {
        const { resolve, candidates } = this.pending;
        this.pending = null;
        resolve([...candidates.values()].sort((a, b) => b.cp - a.cp));
      }
    }
    // Attentes génériques (uciok, readyok…)
    for (let i = this.lineHandlers.length - 1; i >= 0; i--) {
      if (this.lineHandlers[i].pred(line)) {
        this.lineHandlers[i].cb(line);
        this.lineHandlers.splice(i, 1);
      }
    }
  }

  private waitFor(pred: (l: string) => boolean): Promise<void> {
    return new Promise((res) => this.lineHandlers.push({ pred, cb: () => res() }));
  }

  private send(cmd: string) { this.worker?.postMessage(cmd); }

  setOption(name: string, value: string | number) {
    this.send(`setoption name ${name} value ${value}`);
  }

  /** Analyse MultiPV d'une position. */
  async analyze(fen: string, opts: { movetime?: number; depth?: number; multipv?: number } = {}): Promise<EngineCandidate[]> {
    await this.init();
    const { movetime = 400, depth, multipv = 3 } = opts;
    // Une seule requête à la fois : mise en file.
    while (this.pending) await new Promise((r) => setTimeout(r, 10));
    this.setOption('MultiPV', multipv);
    return new Promise<EngineCandidate[]>((resolve) => {
      this.pending = { resolve, candidates: new Map() };
      this.send(`position fen ${fen}`);
      this.send(depth ? `go depth ${depth}` : `go movetime ${movetime}`);
    }).then((c) => { this.setOption('MultiPV', 1); return c; });
  }

  /** Meilleur coup pur (niveau max). */
  async bestMove(fen: string, movetime = 500): Promise<string | null> {
    const c = await this.analyze(fen, { movetime, multipv: 1 });
    return c[0]?.move ?? null;
  }

  /**
   * Coup pour le niveau 1-10 : Skill Level + temps de réflexion croissants,
   * injection d'imprécisions aux bas niveaux via MultiPV.
   */
  async playMove(fen: string, level: number): Promise<string | null> {
    await this.init();
    const L = Math.min(10, Math.max(1, level));
    const skill = Math.round(((L - 1) / 9) * 20);          // 0 → 20
    const movetime = 80 + L * 60;                            // 140 → 680 ms
    this.setOption('Skill Level', skill);

    if (L <= 7) {
      // MultiPV 3 : choisit parfois le 2e/3e meilleur coup (erreurs crédibles).
      const blunderChance = (8 - L) * 0.11;                  // ~77 % → 11 %
      const cands = await this.analyze(fen, { movetime, multipv: 3 });
      if (!cands.length) return null;
      if (Math.random() < blunderChance && cands.length > 1) {
        // Ne choisit une alternative que si elle ne perd pas une pièce nette.
        const alts = cands.slice(1).filter((c) => cands[0].cp - c.cp < 320);
        if (alts.length) return alts[Math.floor(Math.random() * alts.length)].move;
      }
      return cands[0].move;
    }
    const c = await this.analyze(fen, { movetime, multipv: 1 });
    return c[0]?.move ?? null;
  }

  isReady() { return this.ready; }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}

// Singleton partagé par toute l'application.
export const engine = new StockfishEngine();
