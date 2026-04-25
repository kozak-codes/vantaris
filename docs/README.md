# Vantaris — Design Documentation

> Channel 66 presents the Vantaris Tournament. Civilizations rise. Civilizations fall. The galaxy watches.

This folder contains the canonical design documents for Vantaris, a browser-based 3D hex-globe RTS game. Each document covers a major system. Cross-references link to both design intent and implementation source files.

## Index

| Document | Description |
|---|---|
| [world.md](world.md) | Globe, hexes, biomes, terrain, ruins, world generation |
| [fog-of-war.md](fog-of-war.md) | Server-authoritative fog, visibility states, vision sources |
| [territory.md](territory.md) | Claiming, passive expansion, borders, contestation |
| [units.md](units.md) | Infantry, movement, A* pathfinding, claim timers, capacity |
| [cities.md](cities.md) | City tiers, XP, production, growth, decline, spawning |
| [hud.md](hud.md) | Broadcast-tone UI, panels, tooltips, elimination overlay, chat |
| [day-night.md](day-night.md) | Day/night cycle, rotating sun, terminator gradient, city glow |
| [multiplayer.md](multiplayer.md) | Colyseus rooms, matchmaking, reconnection, per-player slices, chat |
| [stages.md](stages.md) | Phase completion tracker — what's done, what's next |
| [AGENTS.md](AGENTS.md) | Project guide for AI agents — architecture, workflow, conventions |

## Quick Reference

- **Tech stack**: Vite + TypeScript + Three.js (frontend), Colyseus 0.16 (backend), `@vantaris/shared` (monorepo workspace)
- **Tick rate**: `TICK_RATE_MS = 100` (10 ticks/second)
- **Globe**: Subdivided icosahedron → dual graph, ~642 cells at level 3
- **Fog**: 100% server-authoritative — frontend only renders what the server sends
- **Monorepo**: `npm run dev` starts both frontend + backend via concurrently

## Key Source Files

| System | Backend | Frontend | Shared |
|---|---|---|---|
| Globe generation | [`backend/src/globe.ts`](../backend/src/globe.ts) | [`frontend/src/globe/GlobeRenderer.ts`](../frontend/src/globe/GlobeRenderer.ts) | [`shared/src/hexAdjacency.ts`](../shared/src/hexAdjacency.ts) |
| Game state | [`backend/src/state/GameState.ts`](../backend/src/state/GameState.ts) | [`frontend/src/state/ClientState.ts`](../frontend/src/state/ClientState.ts) | [`shared/src/types.ts`](../shared/src/types.ts) |
| Fog of war | [`backend/src/mutations/fog.ts`](../backend/src/mutations/fog.ts) | [`frontend/src/systems/FogRenderer.ts`](../frontend/src/systems/FogRenderer.ts) | — |
| Units | [`backend/src/mutations/units.ts`](../backend/src/mutations/units.ts) | [`frontend/src/systems/UnitRenderer.ts`](../frontend/src/systems/UnitRenderer.ts) | — |
| Cities | [`backend/src/mutations/cities.ts`](../backend/src/mutations/cities.ts) | [`frontend/src/systems/CityRenderer.ts`](../frontend/src/systems/CityRenderer.ts) | — |
| Pathfinding | [`backend/src/systems/Pathfinding.ts`](../backend/src/systems/Pathfinding.ts) | — | — |
| Tick loop | [`backend/src/systems/TickSystem.ts`](../backend/src/systems/TickSystem.ts) | — | [`shared/src/constants.ts`](../shared/src/constants.ts) |
| Room logic | [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts) | [`frontend/src/network/ColyseusClient.ts`](../frontend/src/network/ColyseusClient.ts) | — |
| Input | — | [`frontend/src/input/GlobeInput.ts`](../frontend/src/input/GlobeInput.ts) | — |
| Selection | — | [`frontend/src/systems/SelectionRenderer.ts`](../frontend/src/systems/SelectionRenderer.ts) | — |
| HUD | — | [`frontend/src/ui/HUD.ts`](../frontend/src/ui/HUD.ts) | — |
| Day/Night | — | [`frontend/src/systems/DayNightRenderer.ts`](../frontend/src/systems/DayNightRenderer.ts) | [`shared/src/constants.ts`](../shared/src/constants.ts) |
| Constants | — | [`frontend/src/constants.ts`](../frontend/src/constants.ts) | [`shared/src/constants.ts`](../shared/src/constants.ts) |