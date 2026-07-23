import { useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Arrow } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';

interface BoardProps {
  game: Chess;
  orientation?: 'white' | 'black';
  interactive?: boolean;
  /** Retourne true si le coup doit être accepté. */
  onMove?: (from: string, to: string, promotion?: string) => boolean;
  lastMove?: { from: string; to: string } | null;
  arrows?: Arrow[];
  width?: number;
}

export function Board({ game, orientation = 'white', interactive = true, onMove, lastMove, arrows = [], width }: BoardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const turn = game.turn();
  const myTurn = interactive && ((orientation === 'white' && turn === 'w') || (orientation === 'black' && turn === 'b'));

  // Cases de destination légales pour la pièce sélectionnée
  const targets = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(game.moves({ square: selected as Square, verbose: true }).map((m) => m.to));
  }, [game, selected]);

  const tryMove = (from: string, to: string): boolean => {
    if (!onMove) return false;
    // Promotion automatique en dame (cas le plus courant pour ce site).
    const moves = game.moves({ square: from as Square, verbose: true });
    const needsPromo = moves.some((m) => m.to === to && m.promotion);
    const ok = onMove(from, to, needsPromo ? 'q' : undefined);
    setSelected(null);
    return ok;
  };

  const onPieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!myTurn || !targetSquare) return false;
    return tryMove(sourceSquare, targetSquare);
  };

  const onSquareClick = ({ square }: { square: string }) => {
    if (!myTurn) return;
    if (selected && targets.has(square)) { tryMove(selected, square); return; }
    if (selected === square) { setSelected(null); return; }
    const piece = game.get(square as Square);
    if (piece && piece.color === turn) setSelected(square);
    else setSelected(null);
  };

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: 'rgba(250, 204, 21, 0.35)' };
      styles[lastMove.to] = { backgroundColor: 'rgba(250, 204, 21, 0.45)' };
    }
    if (selected) {
      styles[selected] = { backgroundColor: 'rgba(16, 185, 129, 0.45)' };
      for (const t of targets) {
        const hasPiece = game.get(t as Square);
        styles[t] = {
          background: hasPiece
            ? 'radial-gradient(circle, transparent 55%, rgba(16,185,129,0.55) 56%)'
            : 'radial-gradient(circle, rgba(16,185,129,0.5) 22%, transparent 23%)',
        };
      }
    }
    // Roi en échec en rouge
    if (game.inCheck()) {
      const board = game.board();
      for (const row of board) for (const sq of row) {
        if (sq && sq.type === 'k' && sq.color === turn) {
          styles[sq.square] = { background: 'radial-gradient(circle, rgba(239,68,68,0.75) 30%, transparent 70%)' };
        }
      }
    }
    return styles;
  }, [game, selected, targets, lastMove, turn]);

  return (
    <div style={width ? { width } : undefined} className="overflow-hidden rounded-lg shadow-lg">
      <Chessboard
        options={{
          position: game.fen(),
          boardOrientation: orientation,
          allowDragging: myTurn,
          onPieceDrop,
          onSquareClick,
          squareStyles,
          arrows,
          animationDurationInMs: 200,
          darkSquareStyle: { backgroundColor: '#769656' },
          lightSquareStyle: { backgroundColor: '#eeeed2' },
        }}
      />
    </div>
  );
}
