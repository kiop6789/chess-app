# ♟️ Chess App

Une application web de progression aux échecs : jouez, analysez vos parties, résolvez des puzzles et suivez des leçons — le tout propulsé par le moteur **Stockfish** directement dans le navigateur.

## Fonctionnalités

- **Jouer** — affrontez le moteur Stockfish ou un adversaire en local
- **Analyser** — passez en revue vos parties coup par coup avec l'évaluation du moteur
- **Puzzles** — entraînez votre tactique avec un système de difficulté progressive
- **Ouvertures** — bibliothèque d'ouvertures à étudier
- **Leçons** — parcours pédagogiques structurés
- **Finales** — exercices dédiés aux fins de partie
- **Tableau de bord** — suivez votre progression et vos statistiques

## Stack technique

- **[React 19](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)**
- **[Vite](https://vite.dev/)** — build & dev server
- **[Tailwind CSS](https://tailwindcss.com/)** + composants **Radix UI**
- **[chess.js](https://github.com/jhlywa/chess.js)** — logique du jeu d'échecs
- **[react-chessboard](https://github.com/Clariity/react-chessboard)** — plateau interactif
- **[Stockfish](https://stockfishchess.org/)** (WASM) — moteur d'analyse et d'adversaire IA
- **React Router** — navigation entre les pages
- **Recharts** — visualisation des statistiques

## Installation

Prérequis : **Node.js 22.x** (voir `engines` dans `package.json`)

```bash
npm install
```

## Développement

```bash
npm run dev
```

L'application est disponible sur `http://localhost:5173` avec rechargement à chaud (HMR).

## Build de production

```bash
npm run build
```

Les fichiers optimisés sont générés dans le dossier `dist/`.

Aperçu local du build :

```bash
npm run preview
```

## Lint

```bash
npm run lint
```

## Structure du projet

```
src/
├── components/     # Composants réutilisables (dont le plateau d'échecs)
├── config/         # Configuration des features
├── data/           # Données statiques (puzzles, ouvertures, finales, leçons)
├── engine/         # Intégration Stockfish
├── hooks/          # Hooks React personnalisés
├── lib/            # Utilitaires, gestion des données et du stockage
├── pages/          # Pages de l'application (Play, Puzzles, Analyze, ...)
└── types/          # Types TypeScript partagés
```

## Déploiement

Ce projet est un site statique généré par Vite (`npm run build` → dossier `dist`). Il peut être déployé sur n'importe quelle plateforme de hosting statique : **Vercel**, **Netlify**, **Render**, etc.

> ⚠️ L'application utilise React Router : pensez à configurer une règle de rewrite (`/* → /index.html`) sur votre plateforme d'hébergement pour éviter les erreurs 404 au rafraîchissement des pages.