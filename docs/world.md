# World — Globe, Hexes, Biomes, Terrain

## Hex Globe

The game world is a **geodesic hex sphere** built from a subdivided icosahedron. Each primal vertex becomes a cell center; each primal face centroid becomes a cell vertex. This produces ~642 hexagonal cells and ~12 pentagonal cells at subdivision level 3.

### Config

| Constant | Value | Source |
|---|---|---|
| `GLOBE_CONFIG.radius` | 5 | `shared/src/constants.ts` |
| `GLOBE_CONFIG.subdivideLevel` | 3 | `shared/src/constants.ts` |
| `GLOBE_CONFIG.borderWidth` | 0.3 | `shared/src/constants.ts` |

### Adjacency

The adjacency map is computed once during globe generation and shared across server and client.

- **Hex grid**: [`frontend/src/globe/HexGrid.ts`](../frontend/src/globe/HexGrid.ts) — client-side grid generator with `Map<number, number[]>`
- **Globe generator**: [`backend/src/globe.ts`](../backend/src/globe.ts) — server-side generation using `cell_N` string keys
- **Shared adjacency**: [`shared/src/hexAdjacency.ts`](../shared/src/hexAdjacency.ts) — distance-based fallback adjacency algorithm

> **Important**: The globe generator uses `cell_N` string keys in its adjacency map. The VantarisRoom must use globe adjacency directly without re-prefixing (bug: double-prefix `cell_cell_N` broke pathfinding).

## Biomes

Current biomes assigned via seeded noise:

| Biome | Color | Weight | Passable | Movement Cost (ticks) |
|---|---|---|---|---|
| Ocean | `#1a6b9a` | 35% | No | ∞ |
| Plains | `#4a7c3f` | 25% | Yes | 30 |
| Forest | `#2d5a1b` | 18% | Yes | 60 |
| Mountain | `#7a6a5a` | 10% | Yes | 90 |
| Desert | `#c4a35a` | 7% | Yes | 30 |
| Tundra | `#a8c4cc` | 5% | Yes | 60 |

Config location: `BIOME_CONFIGS` in [`shared/src/constants.ts`](../shared/src/constants.ts)

Movement costs defined in `MOVEMENT_COST` in [`shared/src/constants.ts`](../shared/src/constants.ts)

## Terrain Passability

- `PASSABLE_TERRAIN`: Plains, Forest, Mountain, Desert, Tundra
- `IMPASSABLE_TERRAIN`: Ocean
- A* pathfinding blocks ocean cells: [`backend/src/systems/Pathfinding.ts`](../backend/src/systems/Pathfinding.ts)
- Maximum units per hex: `MAX_UNITS_PER_HEX = 3` (hexes at capacity are impassable unless destination)

## Future: Plate Tectonics (Phase 5)

The current noise-based biome generation will be replaced with a plate tectonics pipeline producing coherent mountain ranges, coastlines, and climate zones. See the main game design document for the full pipeline spec.

## Future: Ruins (Phase 5)

~8–12% of land hexes will contain ruins of the destroyed civilization. Ruin types: Ruined City, Ruined Factory, Ruined Port, Ruined Barracks, Collapsed Mine, Overgrown Farm. Visible from orbit but contents only revealed when a unit enters the hex.

## Cell Data Model (Current)

```typescript
// shared/src/types.ts — HexCell (frontend grid)
interface HexCell {
  id: number
  center: [number, number, number]
  vertexIds: number[]
  biome: BiomeType
  fog: FogVisibility
  isPentagon: boolean
}

// backend/src/state/CellState.ts — Colyseus schema (server state)
class CellState extends Schema {
  cellId: string     // "cell_N"
  biome: BiomeType
  ownerId: string     // player sessionId or ""
  hasCity: boolean
  cityId: string
}
```

### Future Cell Data Model (Phase 5+)

```typescript
interface HexCell {
  cellId: string
  biome: BiomeType
  elevation: number             // -1.0 to 1.0
  moisture: number              // 0.0 to 1.0
  temperature: number           // 0.0 to 1.0
  plateId: string
  isRiverHex: boolean           // Phase 11
  movementCost: number          // derived from terrain + elevation
  resourceYield: ResourceYield  // Phase 7
  ruin: RuinType | null
  ruinRevealed: boolean
}
```