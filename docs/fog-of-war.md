# Fog of War

## Design

Fog is **100% server-authoritative**. The frontend never computes or mutates fog state — it only renders what the server sends.

### Three States

| State | Server Sends | Rendering |
|---|---|---|
| VISIBLE | Full live data — biome, owner, units, structures | Full terrain color |
| REVEALED | Frozen snapshot — last known biome, last known owner, no unit data | Desaturated, 60% dark overlay |
| UNREVEALED | Nothing — cell ID not included in payload | `#111111` near-black |

### Vision Sources

- All hexes **owned by a player** → VISIBLE
- All hexes within `TROOP_VISION_RANGE` (currently 1) of any owned unit → VISIBLE
- Previously VISIBLE, now out of range → REVEALED (snapshot frozen)
- Never seen → UNREVEALED

### Rules

- Fog updates are immediate on the same tick that a unit moves
- Enemy units are never visible through fog
- REVEALED cells show data frozen at the moment visibility was lost
- Ruins visible on UNREVEALED cells as subtle markers (Phase 5 — orbit-visible but contents unknown)

## Implementation

### Server

- **Visibility computation**: [`backend/src/mutations/fog.ts`](../backend/src/mutations/fog.ts) — `computeVisibilityForPlayer()` walks owned territory + unit vision range
- **Player slice builder**: `buildPlayerSlice()` — constructs the per-player payload with only visible/revealed cells, visible units, visible cities
- **Broadcast**: `broadcastPlayerSlices()` called every tick in [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts)

### Client State Types

```typescript
// shared/src/types.ts
interface PlayerStateSlice {
  myPlayerId: string
  currentTick: number
  visibleCells: VisibleCellData[]
  revealedCells: RevealedCellData[]
  units: UnitData[]
  cities: CityData[]
  players: PlayerSummary[]
}
```

### Frontend

- **FogRenderer**: [`frontend/src/systems/FogRenderer.ts`](../frontend/src/systems/FogRenderer.ts) — applies fog colors, owner tints, and territory borders
- **FogOfWar**: [`frontend/src/systems/FogOfWar.ts`](../frontend/src/systems/FogOfWar.ts) — manages fog state transitions (UNREVEALED → REVEALED → VISIBLE)
- **GlobeRenderer**: [`frontend/src/globe/GlobeRenderer.ts`](../frontend/src/globe/GlobeRenderer.ts) — reads fog state and applies biome colors

### Constants

| Constant | Value | Location |
|---|---|---|
| `TROOP_VISION_RANGE` | 1 | `shared/src/constants.ts` |
| `FOG_CONFIG.unexploredColor` | `#0a0a0a` | `shared/src/constants.ts` |
| `FOG_CONFIG.unexploredOpacity` | 0.95 | `shared/src/constants.ts` |
| `FOG_CONFIG.exploredSaturation` | 0.25 | `shared/src/constants.ts` |
| `FOG_CONFIG.exploredBrightness` | 0.35 | `shared/src/constants.ts` |