# Vantaris

A browser-based 3D hex-globe RTS game with multiplayer support via Colyseus.

## Monorepo Structure

```
vantaris/
├── package.json              ← root workspace config, dev scripts
├── frontend/                 ← Vite + TypeScript + Three.js client
├── backend/                  ← Colyseus server (Node.js)
└── shared/                   ← @vantaris/shared — types & constants
```

### Quick Start

```bash
npm install
npm run dev
```

This starts both the Vite dev server (frontend on `http://localhost:5173`) and the Colyseus server (backend on `ws://localhost:2567`).

- `npm run dev:frontend` — Vite only
- `npm run dev:backend` — Colyseus only

### Colyseus Monitor

After starting the backend, the Colyseus monitor is available at `http://localhost:2567/colyseus`.

## Room Types

### lobby_room
Persistent room that broadcasts player counts per queue type every 2 seconds. No game state.

### matchmaking_room
Two variants: `matchmaking_quick` (2–4 players, subdivision level 3) and `matchmaking_standard` (4–8 players, subdivision level 4). When enough players join, a 30-second countdown starts. At countdown end, a `vantaris_room` is created and clients are redirected.

### vantaris_room
The game room. Receives `exploreCell` messages from clients, validates adjacency to owned territory, claims cells, and recomputes fog of war. Sends each player their own `stateUpdate` slice.

## Per-Player State Patching

The server never broadcasts the full `GameState` to all clients. Instead, after any mutation, it computes each player's visible slice:

```typescript
interface PlayerStateSlice {
  visibleCells: CellStateSlice[];    // full live data for VISIBLE cells
  revealedCells: CellSnapshot[];     // stale snapshots for REVEALED cells
  players: PlayerSlice[];            // all players visible to this client
}
```

This ensures players only see cells within their vision range and stale data for previously-seen areas.

## URL Structure

- `?room=<roomId>` — Game room ID for reconnection
- `#cam=lat,lng,zoom` — Camera state hash for reconnection

## Adding a New Queue Type

1. Add the queue type to `QueueType` enum in `shared/src/types.ts`
2. Add config in `QUEUE_CONFIGS` in `shared/src/constants.ts`
3. Register a new matchmaking room variant in `backend/src/index.ts`

## Frontend

### Controls
- **Right-click drag** — Rotate the globe (with inertia)
- **WASD / Arrow keys** — Rotate the globe
- **Scroll wheel** — Zoom in/out
- **Click a visible cell** — Expand territory (or send explore to server in multiplayer)
- **Pinch (mobile)** — Zoom

### Project Structure

```
frontend/src/
├── main.ts              Entry point — room/lobby detection, Three.js setup
├── types/index.ts        Re-exports from @vantaris/shared
├── constants.ts          Re-exports from @vantaris/shared/constants
├── globe/
│   ├── GlobeRenderer.ts  Three.js scene, cell meshes, borders, atmosphere glow, starfield
│   ├── HexGrid.ts        Geodesic grid generation (subdivided icosahedron → dual graph)
│   └── terrain.ts        Seeded biome assignment
├── systems/
│   └── FogOfWar.ts       Fog state management (UNREVEALED → REVEALED → VISIBLE)
├── camera/
│   └── CameraControls.ts Pointer/touch drag, keyboard, zoom with inertia
├── network/
│   ├── ColyseusClient.ts  Client connection, room join/leave, message sending
│   └── RoomPersistence.ts  URL & localStorage helpers for room reconnection
├── debug/
│   └── DebugAPI.ts         window.vantaris debug object
├── ui/
│   ├── HUD.ts              Biome legend, cell tooltip, wordmark
│   └── LobbyUI.ts          Queue selection, countdown, game-ready flow
└── style.css               All UI styling
```

## Backend

```
backend/src/
├── index.ts              Express + Colyseus server setup
├── globe.ts               Server-side globe generation (no Three.js dependency)
├── rooms/
│   ├── VantarisRoom.ts    Game room — explore, fog, territory
│   ├── MatchmakingRoom.ts Queue room — countdown, launch game
│   └── LobbyRoom.ts       Colyseus built-in lobby
├── state/
│   ├── GameState.ts        Root game state (cells, players, phase, turn)
│   ├── CellState.ts       Cell with biome and owner
│   ├── PlayerState.ts     Player with territory count and per-player fog
│   ├── FogState.ts        Per-player fog visibility + snapshots
│   └── MatchmakingState.ts Queue type, player count, countdown, phase
└── mutations/
    ├── fog.ts              revealCellForPlayer, snapshotAndHideCell, computeVisibilityForPlayer
    ├── territory.ts        claimCell, loseCell
    └── matchmaking.ts     addPlayerToQueue, removePlayerFromQueue, startCountdown, tickCountdown
```

## Shared Package

`@vantaris/shared` contains all enums, interfaces, and constants used by both frontend and backend:
- `BiomeType`, `FogVisibility`, `GamePhase`, `QueueType` enums
- `CellSnapshot`, `SpawnPoint`, `PlayerStateSlice` interfaces
- `HexCell`, `HexGrid` interfaces (frontend-local geometry)
- All constants: biome configs, queue configs, countdown duration, vision range, etc.

## Documentation

- **[docs/AGENTS.md](docs/AGENTS.md)** — Architecture guide, dev workflow, module API reference