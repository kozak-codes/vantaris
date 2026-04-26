# Vantaris

A multiplayer hex-based strategy game played on a spherical globe, built with Three.js and Colyseus.

![License: CAL 1.0](https://img.shields.io/badge/License-CAL%201.0-blue)

## Overview

Vantaris is a real-time strategy game where players compete on a procedurally generated planet. Build cities, train units, claim territory, and battle for control of the globe.

- **Spherical hex grid** — territory and movement wrap around a planet, not a flat map
- **Real-time multiplayer** — WebSocket-based via Colyseus
- **Fog of war** — players can only see territory they've explored
- **Resources & production** — cities produce resources, buildings refine them
- **Day/night cycle** — affects visibility and strategy

## Quick Start

```bash
git clone https://github.com/kozak-codes/vantaris.git
cd vantaris
npm ci
npm run dev
```

- Frontend: http://localhost:5173
- Backend: ws://localhost:2567
- Colyseus monitor: http://localhost:2567/colyseus

## Project Structure

```
vantaris/
├── frontend/          # Three.js client (Vite + TypeScript)
│   ├── src/
│   │   ├── globe/     # Hex grid, terrain rendering, globe renderer
│   │   ├── systems/   # Renderers (units, cities, fog, etc.)
│   │   ├── network/   # Colyseus client, room persistence
│   │   ├── ui/        # HUD, lobby, chat
│   │   └── state/     # Client-side state management
│   └── .env.production  # wss://api.vantaris.gg
├── backend/           # Colyseus server (Node.js + TypeScript)
│   ├── src/
│   │   ├── rooms/     # VantarisRoom, MatchmakingRoom, LobbyRoom
│   │   ├── state/     # Game state schemas
│   │   ├── mutations/ # Game logic (units, cities, fog, resources)
│   │   ├── systems/   # Pathfinding, tick system
│   │   └── worldgen/  # Procedural world generation
│   ├── worker.ts      # Cloudflare Worker entry (container proxy)
│   └── wrangler.toml  # Cloudflare deployment config
├── shared/            # Shared types, constants, and utilities
│   └── src/
│       ├── types/     # BiomeType, UnitType, CellSnapshot, etc.
│       ├── constants/ # Game config (biomes, globe, fog, camera)
│       └── hexAdjacency.ts
├── Dockerfile         # Backend container image
├── .github/workflows/ # CI/CD (deploy on push to master)
└── docs/              # Game design documents
```

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend concurrently |
| `npm run dev:frontend` | Start Vite dev server only |
| `npm run dev:backend` | Start Colyseus server only |
| `npm run build` | Build all workspaces |
| `npm test` | Run tests with Vitest |

### Environment Variables

**Frontend** (`.env.development` / `.env.production`):

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SERVER_URL` | Colyseus server WebSocket URL | `ws://localhost:2567` |

**Backend** (set via Cloudflare Container envVars):

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP/WebSocket port | `2567` |
| `ALLOWED_ORIGIN` | CORS origin for production | `https://vantaris.gg` |

## Deployment

Vantaris is deployed on Cloudflare:

- **Frontend**: Cloudflare Pages (static Vite build)
- **Backend**: Cloudflare Containers (Dockerized Node.js + Colyseus, proxied by a Worker)
- **CI/CD**: GitHub Actions — pushes to `master` auto-deploy

The backend container uses `sleepAfter: 30m` to minimize costs when idle. Cold start takes ~5-10 seconds.

### Manual Deploy

```bash
# Backend
cd backend && CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy

# Frontend
npm run build --workspace=frontend
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx wrangler pages deploy frontend/dist --project-name=vantaris
```

Required GitHub secrets for CI/CD:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Architecture

```
Browser (Three.js)
  │ WebSocket
  ▼
Cloudflare Worker ──► Cloudflare Container (Node.js + Colyseus)
  │
  ▼
Cloudflare Pages (static frontend)
```

The Worker handles routing and proxying. The Container runs the full Colyseus game server. When idle for 30 minutes, the container hibernates; the Worker restarts it on the next request.

## Documentation

Game design docs are in [`docs/`](docs/):

- [Design v0](docs/design-v0.md) — original vision
- [World generation](docs/world.md), [plate tectonics](docs/plate-tectonics.md)
- [Units](docs/units.md), [Cities](docs/cities.md), [Territory](docs/territory.md)
- [Fog of war](docs/fog-of-war.md), [Day/night](docs/day-night.md)
- [Multiplayer architecture](docs/multiplayer.md)

## License

This project is licensed under the [Cryptographic Autonomy License 1.0 (Combined Work Exception)](LICENSE).

In short: you can use, modify, and distribute this software freely, including as part of larger combined works. You must provide recipients access to the source code and their own user data. You may not use the software to limit the autonomy of others. See [LICENSE](LICENSE) for full terms.