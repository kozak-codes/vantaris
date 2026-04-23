# AGENTS.md — Vantaris Project Guide

## Project Overview

Vantaris is a browser-based 3D hex-globe RTS game with multiplayer support via Colyseus. Phase 2 adds a Colyseus backend with matchmaking, lobby, fog of war state, and room persistence.

### Monorepo Structure

```
vantaris/
├── package.json              ← root workspace config, dev scripts
├── frontend/                 ← Vite + TypeScript + Three.js client
│   ├── package.json
│   ├── vite.config.ts         ← aliases for @vantaris/shared
│   ├── tsconfig.json
│   └── src/
├── backend/                   ← Colyseus server (Node.js)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           ← Express + Colyseus + WebSocket transport
│       ├── globe.ts            ← Server-side globe generation (no Three.js)
│       ├── rooms/
│       │   ├── VantarisRoom.ts ← Game room: explore, fog, territory
│       │   ├── MatchmakingRoom.ts ← Queue room: countdown, launch game
│       │   └── LobbyRoom.ts    ← Colyseus built-in lobby
│       ├── state/
│       │   ├── GameState.ts    ← Root game state (cells, players, phase, turn)
│       │   ├── CellState.ts    ← Cell with biome and owner
│       │   ├── PlayerState.ts  ← Player with territory count and per-player fog
│       │   ├── FogState.ts     ← Per-player fog visibility + snapshots
│       │   └── MatchmakingState.ts ← Queue type, player count, countdown, phase
│       └── mutations/
│           ├── fog.ts           ← revealCellForPlayer, snapshotAndHideCell, computeVisibilityForPlayer
│           ├── territory.ts     ← claimCell, loseCell
│           └── matchmaking.ts  ← addPlayerToQueue, removePlayerFromQueue, startCountdown, tickCountdown
└── shared/                     ← @vantaris/shared — types & constants
    ├── package.json
    └── src/
        ├── types.ts             ← Enums, interfaces for both frontend & backend
        └── constants.ts         ← Biome configs, globe/fog/camera/queue constants
```

## Development Workflow

### Starting the dev servers

```bash
npm install
npm run dev              # Starts both frontend + backend via concurrently
npm run dev:frontend     # Vite only (http://localhost:5173)
npm run dev:backend      # Colyseus only (ws://localhost:2567)
```

Colyseus monitor available at `http://localhost:2567/colyseus`.

### Type checking

```bash
cd frontend && npx tsc --noEmit
cd backend && npx tsc --noEmit
```

### URL structure

- `?room=<roomId>` — Game room ID for reconnection
- `#cam=lat,lng,zoom` — Camera state hash for reconnection

## Frontend Architecture

```
frontend/src/
├── main.ts              Entry point — lobby/room detection, Three.js setup
├── types/index.ts        Re-exports from @vantaris/shared
├── constants.ts          Re-exports from @vantaris/shared/constants
├── globe/
│   ├── GlobeRenderer.ts  Three.js scene, cell meshes, borders, atmosphere glow, starfield
│   ├── HexGrid.ts         Geodesic grid generation (subdivided icosahedron → dual graph)
│   └── terrain.ts         Seeded biome assignment
├── systems/
│   └── FogOfWar.ts       Fog state management (UNREVEALED → REVEALED → VISIBLE)
├── camera/
│   └── CameraControls.ts Pointer/touch drag, keyboard, zoom with inertia
├── network/
│   ├── ColyseusClient.ts  Client connection, room join/leave, message sending
│   └── RoomPersistence.ts  URL & localStorage helpers for room reconnection
├── debug/
│   └── DebugAPI.ts        window.vantaris debug object
├── ui/
│   ├── HUD.ts             Biome legend, cell tooltip, wordmark
│   └── LobbyUI.ts         Queue selection, countdown, game-ready flow
└── style.css              All UI styling
```

### Key Design Decisions

- **Decoupled rendering**: `FogOfWar` manages cell state; `GlobeRenderer` reads state and applies colors. No direct mesh manipulation from systems.
- **Dual graph geometry**: Each primal vertex becomes a cell center; each primal face centroid becomes a cell vertex. ~12 pentagons + ~630 hexagons at subdivision 3.
- **Pivot-based rotation**: Camera stays fixed; the pivot rotates using premultiplied quaternions for world-space rotations.
- **Per-player state patching**: Server never broadcasts full GameState. After mutations, each player gets their own `stateUpdate` slice containing only visible/revealed cells.
- **Dual-mode frontend**: Works in local mode (no server, local fog computation) or online mode (server-driven fog). The lobby UI appears when no `?room=` param is in the URL.

## Shared Package

`@vantaris/shared` (in `shared/src/`) contains all enums, interfaces, and constants:

- **Enums**: `BiomeType`, `FogVisibility`, `GamePhase`, `QueueType`
- **Interfaces**: `CellSnapshot`, `SpawnPoint`, `HexCell`, `HexGrid`, player/slice types
- **Constants**: `BIOME_CONFIGS`, `GLOBE_CONFIG`, `FOG_CONFIG`, `CAMERA_CONFIG`, `QUEUE_CONFIGS`, `COUNTDOWN_DURATION`, `RECONNECTION_WINDOW`, `STARTING_TERRITORY_SIZE`, `VISION_RANGE`

Frontend aliases resolve `@vantaris/shared` and `@vantaris/shared/constants` via Vite config + tsconfig paths.

## Room Types

- **lobby_room**: Persistent Colyseus LobbyRoom. Broadcasts queue counts.
- **matchmaking_quick**: Quick match queue (2–4 players, subdivision 3)
- **matchmaking_standard**: Standard queue (4–8 players, subdivision 4)
- **vantaris_room**: Game room with per-player fog, territory claiming, explore messages

## Debug API

The game exposes a `window.vantaris` object in the browser console for live debugging.

### Fog Controls

```js
vantaris.fog.revealAll()        // Set all cells to VISIBLE
vantaris.fog.hideAll()          // Set all cells to UNREVEALED
vantaris.fog.revealCell(id)     // Expand from a VISIBLE cell
vantaris.fog.revealTerritory()  // Re-roll starting territory
vantaris.fog.getState(id)      // Get fog state: "VISIBLE" | "REVEALED" | "UNREVEALED"
vantaris.fog.count()            // Returns { visible, revealed, unrevealed } counts
```

### Camera Controls

```js
vantaris.camera.focusCell(id)  // Rotate globe to face a specific cell
vantaris.camera.zoom(distance) // Set zoom distance (7–25)
vantaris.camera.resetRotation() // Reset globe rotation
vantaris.camera.getZoom()      // Get current camera distance
```

### State Inspection

```js
vantaris.state.cell(id)    // Full cell info
vantaris.state.gridInfo    // Grid summary
vantaris.state.fps()       // Current FPS
```

## Constants Reference

| Constant | Location | Default |
|----------|----------|---------|
| `GLOBE_CONFIG.radius` | shared/constants | 5 |
| `GLOBE_CONFIG.subdivideLevel` | shared/constants | 3 |
| `BIOME_CONFIGS` | shared/constants | 6 biomes |
| `FOG_CONFIG.revealedCellCount` | shared/constants | 7 |
| `CAMERA_CONFIG.minDistance` | shared/constants | 7 |
| `CAMERA_CONFIG.maxDistance` | shared/constants | 25 |
| `QUEUE_CONFIGS.QUICK.minPlayers` | shared/constants | 2 |
| `QUEUE_CONFIGS.STANDARD.maxPlayers` | shared/constants | 8 |
| `COUNTDOWN_DURATION` | shared/constants | 30 |
| `RECONNECTION_WINDOW` | shared/constants | 60 |
| `VISION_RANGE` | shared/constants | 1 |

## Self-Improving Documentation

When making changes:
1. Update `docs/AGENTS.md` if architecture, interfaces, or workflow changes
2. Update `README.md` if structure, commands, or modules change
3. Update `shared/src/types.ts` comments when adding/changing interfaces
4. Update `shared/src/constants.ts` comments when tuning values