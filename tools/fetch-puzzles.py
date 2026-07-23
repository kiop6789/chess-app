#!/usr/bin/env python3
"""Filtre la base de puzzles Lichess en streaming (stdin = flux .zst).

Sélectionne ~4600 puzzles de qualité répartis par bandes de rating,
convertit en JSON compact : [id, fen, moves, rating, themes_mask].

Usage : curl -s <url> | python3 tools/fetch-puzzles.py
"""
import io
import json
import sys
from pathlib import Path

import zstandard

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "puzzles"
OUT.mkdir(parents=True, exist_ok=True)

# Bandes de rating et quotas
BANDS = [
    (600, 1000, 500),
    (1000, 1300, 800),
    (1300, 1600, 900),
    (1600, 1900, 900),
    (1900, 2200, 700),
    (2200, 2500, 500),
    (2500, 9999, 300),
]

MATE_THEMES = {
    "backRankMate", "smotheredMate", "anastasiaMate", "arabianMate", "bodenMate",
    "dovetailMate", "hookMate", "swallowtailMate", "vukovicMate", "doubleBishopMate",
    "killBoxMate", "triangleMate", "operaMate", "epauletteMate", "pillsburyMate",
    "morphyMate", "maxLangeMate", "balestraMate", "blindSwine", "cornerMate", "crossCheck",
}
CATEGORIES = [
    "mat1", "mat2", "mat", "fourchette", "clouage", "enfilade", "decouverte",
    "sacrifice", "deviation", "intermediaire", "finale", "pieceEnPrise",
    "promotion", "calme", "rayonX", "degagement",
]


def theme_mask(themes: str) -> int:
    t = set(themes.split())
    cats = set()
    if "mateIn1" in t:
        cats.add("mat1")
    if "mateIn2" in t:
        cats.add("mat2")
    if t & {"mateIn3", "mateIn4", "mateIn5"} or (t & MATE_THEMES):
        cats.add("mat")
    if "fork" in t:
        cats.add("fourchette")
    if "pin" in t:
        cats.add("clouage")
    if "skewer" in t:
        cats.add("enfilade")
    if t & {"discoveredAttack", "doubleCheck"}:
        cats.add("decouverte")
    if "sacrifice" in t:
        cats.add("sacrifice")
    if t & {"deflection", "attraction"}:
        cats.add("deviation")
    if "intermezzo" in t:
        cats.add("intermediaire")
    if t & {"endgame", "pawnEndgame", "rookEndgame", "bishopEndgame",
            "knightEndgame", "queenEndgame", "queenRookEndgame"}:
        cats.add("finale")
    if t & {"hangingPiece", "trappedPiece"}:
        cats.add("pieceEnPrise")
    if t & {"promotion", "advancedPawn", "underPromotion"}:
        cats.add("promotion")
    if t & {"quietMove", "zugzwang", "defensiveMove"}:
        cats.add("calme")
    if t & {"xRayAttack", "exposedKing"}:
        cats.add("rayonX")
    if t & {"clearance", "interference"}:
        cats.add("degagement")
    mask = 0
    for i, c in enumerate(CATEGORIES):
        if c in cats:
            mask |= 1 << i
    return mask


def main() -> None:
    counts = [0] * len(BANDS)
    seen = set()
    out: list[list] = [[] for _ in BANDS]

    dctx = zstandard.ZstdDecompressor(max_window_size=2**27)
    with dctx.stream_reader(sys.stdin.buffer) as reader:
        text = io.TextIOWrapper(reader, encoding="utf-8")
        header = True
        for line in text:
            if header:
                header = False
                continue
            parts = line.rstrip("\n").split(",")
            if len(parts) < 8:
                continue
            pid, fen, moves, rating, _rd, popularity, nbplays, themes = parts[:8]
            try:
                r = int(rating)
                pop = int(popularity)
                plays = int(nbplays)
            except ValueError:
                continue
            if pop < 80 or plays < 200:
                continue
            mask = theme_mask(themes)
            if mask == 0:
                continue
            for bi, (lo, hi, quota) in enumerate(BANDS):
                if lo <= r < hi and counts[bi] < quota:
                    if pid in seen:
                        break
                    seen.add(pid)
                    out[bi].append([pid, fen, moves, r, mask])
                    counts[bi] += 1
                    break
            if all(counts[i] >= BANDS[i][2] for i in range(len(BANDS))):
                break

    meta = []
    for bi, (lo, hi, _q) in enumerate(BANDS):
        fn = f"band{bi}.json"
        (OUT / fn).write_text(json.dumps(out[bi], separators=(",", ":")), encoding="utf-8")
        meta.append({"band": bi, "min": lo, "max": None if hi > 9000 else hi,
                     "file": fn, "count": len(out[bi])})
        print(f"bande {lo}-{hi}: {len(out[bi])} puzzles")
    (OUT / "index.json").write_text(json.dumps({"bands": meta, "categories": CATEGORIES}, indent=2))
    print(f"TOTAL: {sum(counts)} puzzles")


if __name__ == "__main__":
    main()
