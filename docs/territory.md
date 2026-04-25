# Territory & Claiming

## Active Claiming (Military)

An infantry unit standing on an unclaimed or enemy hex begins a claim timer. The unit must remain stationary (IDLE) on the hex for the full duration.

| Target | Claim Time | Constant |
|---|---|---|
| Unclaimed hex | 50 ticks (5 seconds) | `CLAIM_TICKS_UNCLAIMED = 50` |
| Enemy hex (uncontested) | 3000 ticks (5 minutes) | `CLAIM_TICKS_ENEMY = 3000` |
| Enemy hex (contested) | Timer pauses | Both players' units present |

If two players both have units on a hex, the claim timer pauses for both. Last unit standing resumes their claim.

### Auto-Claim on Arrival

When a unit finishes moving onto an unclaimed hex, the server automatically starts claiming:

```typescript
// In VantarisRoom.processUnitMovement():
if (result && result.arrived) {
  const cell = this.state.cells.get(result.cellId);
  if (cell && !cell.ownerId) {
    startClaiming(this.state, unit.unitId);
  }
}
```

Source: [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts) line ~181

### Claim Prevention

Cannot claim tiles you already own — both server and client enforce this:

```typescript
// Server: handleClaimTerritory
if (cell && cell.ownerId === playerId) return;

// Also: startClaiming checks ownerId before starting
```

Source: [`backend/src/mutations/units.ts`](../backend/src/mutations/units.ts) — `startClaiming()`

## Passive Expansion (Phase 4 — partially implemented)

Cities radiate cultural influence. Higher tier cities expand faster:

| City Tier | Passive Expansion Rate |
|---|---|
| Settlement (1) | None |
| Village (2) | 1 hex per 120 ticks |
| Town (3) | 1 hex per 60 ticks |
| City (4) | 1 hex per 30 ticks |
| Metropolis (5) | 1 hex per 15 ticks |
| Megacity (6) | 1 hex per 5 ticks |

Not yet implemented in current backend.

## Territory Rendering

- Each owned hex receives a subtle owner-color tint
- Borders render only on hex edges adjacent to a different owner or unclaimed hex
- Border rendering: [`frontend/src/systems/FogRenderer.ts`](../frontend/src/systems/FogRenderer.ts) — `rebuildOwnerBorders()`
- All overlay meshes (icons, rings, lines) have `raycast = () => {}` to prevent intercepting pointer rays meant for hex cells

## Spawning

- First city always spawns on a PLAINS hex (`VALID_CITY_SPAWN_TERRAIN`)
- Fallback if no plains: Desert → Tundra (warning logged)
- Minimum 2-hex buffer between spawn points (checks neighbors-of-neighbors)
- Spawn hex + 6 immediate neighbors claimed on join
- Source: [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts) — `findAvailableSpawnCell()`

## Constants

| Constant | Value | Location |
|---|---|---|
| `CLAIM_TICKS_UNCLAIMED` | 50 | `shared/src/constants.ts` |
| `CLAIM_TICKS_ENEMY` | 3000 | `shared/src/constants.ts` |
| `STARTING_TERRITORY_SIZE` | 1 | `shared/src/constants.ts` |
| `MAX_UNITS_PER_HEX` | 3 | `shared/src/constants.ts` |
| `VALID_CITY_SPAWN_TERRAIN` | `[PLAINS]` | `shared/src/constants.ts` |