# Plate Tectonics World Generation

> Replaces the old weighted-random biome assignment with a simplified plate tectonics simulation that produces coherent geography.

## Pipeline Overview

1. **Tectonic Plates** — scatter seed points, Voronoi assign each hex to a plate
2. **Boundary Classification** — classify every edge between two plates by drift vector
3. **Elevation** — base from plate type + boundary modifier, noise pass for local variation
4. **Climate** — latitude bands set temperature, prevailing winds + mountains create rain shadows
5. **Biome Matrix** — moisture × temperature × elevation → biome
6. **Resource Yields** — derived from terrain (stub)
7. **Ruin Placement** — scatter ruins based on logical old-civilization placement

## Step 1 — Tectonic Plates

- Scatter N seed points on the sphere (8–20 plates, configurable)
- Each plate assigned:
  - `plateId: string`
  - `type: 'oceanic' | 'continental'`
  - `driftVector: [number, number, number]` — unit vector on sphere surface for plate movement direction
- Voronoi assignment: each hex cell gets the `plateId` of the nearest seed point (great-circle distance)
- ~60% of plates are oceanic, ~40% continental
- Seed: hash of room ID or configurable

## Step 2 — Boundary Classification

Every hex edge between two different plates is a boundary. Classified by relative drift:

| Boundary Type | Condition | Effect |
|---|---|---|
| Convergent continental + continental | Plates moving toward each other, both continental | Mountain range |
| Convergent continental + oceanic | Plates moving toward each other, one oceanic | Coastal mountains on continental side |
| Convergent oceanic + oceanic | Both oceanic, moving toward each other | Deep ocean (no special effect) |
| Divergent continental | Continental plate splitting | Rift valley, potential inland sea |
| Divergent oceanic | Oceanic plate splitting | Mid-ocean ridge (minor) |
| Transform | Plates sliding past each other | Fault line, moderate elevation |

Drift classification: dot product of the two plates' drift vectors along the normal between their centers tells convergence vs divergence.

## Step 3 — Elevation

```
baseElevation:
  oceanic plate center: -0.5
  continental plate center: +0.3

boundaryModifier (applied to cells within 2 hexes of boundary):
  convergent continental + continental: +0.6
  convergent continental + oceanic: +0.4 (continental side), -0.2 (oceanic side)
  divergent continental: -0.3
  transform: +0.1
  divergent oceanic: +0.05

localNoise: single Simplex noise pass, amplitude 0.15

finalElevation = clamp(base + boundaryDistanceModifier * boundaryModifier + localNoise, -1.0, 1.0)
seaLevel = 0.0
```

Everything below 0.0 → ocean. Everything above → land. The noise pass ensures not all boundaries are perfectly straight.

## Step 4 — Climate

```
temperature:
  base = 1.0 - 2.0 * abs(latitude)   // latitude from pole-to-pole normalized 0..1
  elevationPenalty = -0.3 * elevation  // mountains are colder
  temperature = clamp(base + elevationPenalty, 0.0, 1.0)

moisture:
  baseMoisture near equator = 0.7
  baseMoisture near poles = 0.3
  prevailing wind: eastward (simple model)
  rain shadow: if mountain blocks wind path, downwind cells get -0.3 moisture
  moisture = clamp(baseMoisture + noiseMoisture + rainShadow, 0.0, 1.0)
```

Rain shadow simplified: for each cell, trace 2 steps upwind (westward). If any upwind cell has elevation > 0.4, reduce moisture by 0.3.

## Step 5 — Biome Matrix

| | Cold (<0.25) | Temperate (0.25–0.5) | Warm (0.5–0.75) | Hot (>0.75) |
|---|---|---|---|---|
| High moisture (>0.65) | Tundra | Forest | Jungle→Forest | Rainforest→Forest |
| Med moisture (0.35–0.65) | Tundra | Plains | Savanna→Plains | Plains |
| Low moisture (<0.35) | Ice→Tundra | Desert | Desert | Desert |
| High elevation (>0.5) | Mountain | Mountain | Mountain | Mountain |
| Below sea level | Ocean | Ocean | Ocean | Ocean |

*Stub entries (Jungle, Savanna, Rainforest, Ice) map to nearest existing biome.*

## Step 6 — Resource Yields (Stub)

| Terrain | Primary Resource |
|---|---|
| Mountain | Ore |
| Plains | Food |
| Forest | Timber |
| Desert | (none) |
| Tundra | (none) |
| Ocean | (none) |

Each hex gets a `resourceYield: ResourceYield` with the primary resource type.

## Step 7 — Ruin Placement

After biome and resource assignment, scatter ruins. ~8–12% of land hexes.

**Ruin types and placement logic:**

| Ruin | Original | Placement Rule | Restoration Cost | Benefit |
|---|---|---|---|---|
| Ruined City | City | Near plains + water (hex has ocean neighbor) | Engineer + Construction Kit | Functional Settlement |
| Ruined Factory | Factory | Near mountains (within 2 hexes of Mountain) | Engineer + Metal Bars | Factory at L1 XP |
| Ruined Port | Trade Post | On coastline (hex has ocean neighbor) | Engineer | Trade Post + naval access |
| Ruined Barracks | Barracks | Near plains | Engineer | Barracks + minor bonus |
| Collapsed Mine | Mine | On mountain hex with high ore yield | Engineer | Mine with higher yield |
| Overgrown Farm | Farm | On plains or forest | Half cost of new farm | Farm at reduced cost |

**Placement algorithm:**
1. Collect candidate hexes per ruin type based on rules above
2. For each ruin type, randomly select ~1.5% of candidates (adjust to hit ~8-12% total)
3. Cluster loosely: if a hex gets a ruin, its neighbors get slightly higher ruin probability
4. Skip hexes within 4 cells of spawn points (fairness)

**Visibility:**
- Ruins visible as subtle markers on UNREVEALED cells (orbital survey — everyone can see ruin markers)
- Ruin type + restoration cost only revealed when a unit enters the hex
- `ruinRevealed: boolean` per cell — starts false, set true on unit entry

## Implementation Files

```
backend/src/worldgen/
├── plates.ts        ← Step 1: plate seeds, Voronoi, drift vectors
├── boundaries.ts   ← Step 2: edge classification
├── elevation.ts     ← Step 3: elevation computation
├── climate.ts       ← Step 4: temperature + moisture
├── biomes.ts        ← Step 5: biome matrix lookup
├── resources.ts     ← Step 6: resource yield stubs
└── ruins.ts         ← Step 7: ruin placement

shared/src/types.ts  ← RuinType, ResourceYield, per-cell data
backend/src/globe.ts ← Updated to call worldgen pipeline
```

## Seeded Random

All worldgen uses a seeded PRNG for reproducibility. Seed derived from room ID or configurable per room.

## Relationship to Old Code

- `backend/src/globe.ts` — keeps the icosahedron subdivision + adjacency, but biome assignment replaced by worldgen pipeline
- `frontend/src/globe/terrain.ts` — `assignBiomes()` removed; frontend no longer assigns biomes (server sends them)
- `shared/src/constants.ts` — `BIOME_CONFIGS` kept for colors, weights used only for plate type ratios