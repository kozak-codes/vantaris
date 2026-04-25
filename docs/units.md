# Units

## Current Units

### Infantry

| Property | Value |
|---|---|
| Type | `INFANTRY` |
| Movement | Server-side A* pathfinding |
| Vision range | `TROOP_VISION_RANGE = 1` hex |
| Actions | Move, Claim territory, Set idle |

### Engineer (Phase 7)

| Property | Value |
|---|---|
| Type | `ENGINEER` |
| Movement | Server-side A* pathfinding (same as infantry) |
| Vision range | `TROOP_VISION_RANGE = 1` hex |
| Production cost | `ENGINEER_PRODUCTION_TICKS = 300` |
| Actions | Move, Claim, Build structure, Restore ruin |
| Build time | Farm=200t, Mine=300t, Power Plant=250t, Ruin Restore=400t |

Build placement rules:
- **Farm**: Plains, Forest
- **Mine**: Mountain, Forest
- **Power Plant**: Mountain, Desert, Tundra

Source: [`shared/src/constants.ts`](../shared/src/constants.ts) — `BUILDING_TICKS`, `BUILDING_PLACEMENT_RULES`
Source: [`backend/src/mutations/buildings.ts`](../backend/src/mutations/buildings.ts) — `createBuilding()`, `canPlaceBuilding()`

## Movement

1. Player selects unit → clicks destination tile
2. Server computes A* path via [`backend/src/systems/Pathfinding.ts`](../backend/src/systems/Pathfinding.ts)
3. Path assigned to unit as `string[]` of cell IDs
4. Each tick, `stepUnit()` advances the unit one step along its path
5. Movement cost per terrain type defined in `MOVEMENT_COST` ([`shared/src/constants.ts`](../shared/src/constants.ts))

### Movement Costs (in ticks)

| Terrain | Cost |
|---|---|
| Plains | 30 |
| Desert | 30 |
| Forest | 60 |
| Mountain | 90 |
| Tundra | 60 |
| Ocean | ∞ |

### Client-Side Interpolation

The frontend uses clock-driven interpolation for smooth unit movement:

- `stepStartTime` and `stepEndTime` computed when a step begins
- Progress = `(now - stepStartTime) / (stepEndTime - stepStartTime)`
- When `remaining >= total` (step just started), set `stepStartTime = now` so progress starts at exactly 0
- Source: [`frontend/src/systems/UnitRenderer.ts`](../frontend/src/systems/UnitRenderer.ts)

### Path Request Flow

```
Client → ColyseusClient.sendMoveUnit(unitId, targetCellId)
Server → VantarisRoom.handleMoveUnit()
       → findPath() with A*
       → assignPath() sets unit.path, status=MOVING
Server → Each tick: stepUnit() advances one step
       → On arrival: auto-claim if unclaimed
Client → stateUpdate arrives, UnitRenderer interpolates
```

## Unit Capacity

- Maximum `MAX_UNITS_PER_HEX = 3` units per hex
- Hexes at capacity are impassable (exception: destination hex)
- Checked by `buildUnitsByCellId()` in pathfinding

## Claiming

- Infantry can claim territory by standing still on an unclaimed or enemy hex
- Auto-claim triggers when a unit arrives at an unclaimed hex
- Cannot claim hexes you already own
- Claim timer: 50 ticks unclaimed, 3000 ticks enemy
- Source: [`backend/src/mutations/units.ts`](../backend/src/mutations/units.ts) — `startClaiming()`, `completeClaim()`

## Unit Data Model

```typescript
// shared/src/types.ts
interface UnitData {
  unitId: string
  ownerId: string
  type: string         // "INFANTRY" or "ENGINEER"
  status: string       // IDLE | MOVING | CLAIMING | BUILDING
  cellId: string
  path: string[]       // Array of cell IDs for remaining path
  movementTicksRemaining: number
  movementTicksTotal: number
  claimTicksRemaining: number
  buildTicksRemaining: number
}

// backend/src/state/UnitState.ts — Colyseus schema
class UnitState extends Schema {
  unitId: string
  ownerId: string
  type: string            // "INFANTRY" or "ENGINEER"
  status: string          // IDLE | MOVING | CLAIMING | BUILDING
  cellId: string
  movementTicksRemaining: number
  movementTicksTotal: number
  path: string            // JSON stringified array
  claimTicksRemaining: number
  buildTicksRemaining: number
}
```

## Client Controls

- Click unit to select → auto-enters move mode if idle
- Click tile while unit selected → sends move command
- Press 1 on tile: selects first idle unit on that tile (skips moving units)
- Hover highlights: white = base hover, purple = move target, yellow = claim target
- Source: [`frontend/src/input/GlobeInput.ts`](../frontend/src/input/GlobeInput.ts)

## Rendering

- Infantry icons are 2D planes oriented radially outward from globe surface (NOT Three.js Sprites)
- Icons created via IconFactory: [`frontend/src/systems/IconFactory.ts`](../frontend/src/systems/IconFactory.ts)
- Selection indicator: small white circle (not full hex ring)
- Source: [`frontend/src/systems/UnitRenderer.ts`](../frontend/src/systems/UnitRenderer.ts)

## Future Unit Types

| Unit | Terrain | Role | Phase |
|---|---|---|---|
| Engineer | Land | Construction, ruin restoration | 7 |
| Cavalry | Plains/Desert | High mobility | 11 |
| Artillery | Land (slow) | High attack | 11 |
| Navy | Ocean | Sea lane control | 11 |
| Trader | Land/Sea | Economic, non-combat | 9 |