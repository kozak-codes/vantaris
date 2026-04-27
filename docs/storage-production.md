# Storage & Production System

## Overview

Every settlement (city) maintains a **stockpile** of resources, organized by category. Resources flow in from extractors and factories, and are consumed by population upkeep and unit production. The system tracks recent inflows so players can see where resources are coming from.

## Resource Categories

Resources are grouped into three categories (configured in `CFG.RESOURCE_CATEGORIES` and `CFG.RESOURCES[].category`):

| Category | Resources | Description |
|---|---|---|
| **Food** | BREAD, GRAIN, OIL | Feeds population; fuels unit production (FOOD cost) |
| **Industry** | ORE, STEEL, TIMBER, LUMBER | Used for building and unit production (MATERIAL cost) |
| **Energy** | POWER | Powers population upkeep and tier benefits |

The category mapping is stored in `RESOURCE_CATEGORY_MAP` (derived from `CFG.RESOURCES`). See: [`shared/src/constants.ts`](../shared/src/constants.ts)

## Stockpile Storage

### Data Model

Each city stores its stockpile as a JSON-encoded `Record<string, number>` on `CityState.stockpile` ([`backend/src/state/CityState.ts:26`](../backend/src/state/CityState.ts)). Values are rounded to 0.001 precision and zero-valued entries are pruned.

### Initial Stockpile

New cities start with resources defined in `CFG.CITY.INITIAL_STOCKPILE` ([`shared/src/constants.ts`](../shared/src/constants.ts)):
- BREAD: 60, GRAIN: 40, ORE: 30, STEEL: 10, POWER: 10

### Display

The city panel in the HUD shows stockpile resources grouped by category with totals. Each category row shows the total amount and, on hover, recent inflows (last 100 ticks) broken down by source. Individual resource amounts within each category are shown indented below, rounded to 1 decimal place.

See: [`frontend/src/ui/HUD.ts`](../frontend/src/ui/HUD.ts) — `renderCityPanel()`

### Resource Inflows

Every city tracks recent resource inflows in `CityState.resourceInflows` (JSON array of `ResourceInflowEntry` objects, defined in [`shared/src/types.ts`](../shared/src/types.ts)). Each entry records:
- `resource`: The resource type (e.g., "GRAIN")
- `amount`: How much was added in the last window (rounded to 1 decimal)
- `source`: Where it came from (e.g., "FARM", "FACTORY", "BASE")

Inflows are reset every `CFG.CITY.INFLOW_WINDOW_TICKS` (default: 100) ticks. See: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `addCityInflow()`, `resetCityInflows()`, `tickInflowResets()`

## Resource Generation

### Base Rates

Every tick, each city generates:
- **Grain**: `CFG.CITY.BASE_GRAIN_RATE` (1.0) — doubled from 0.5
- **Power**: `CFG.CITY.BASE_POWER_RATE` (0.3) — new, helps settlements bootstrap

See: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `tickCityResourceDrain()`

### Extractor Output

Buildings with `extractorOutput` (FARM, MINE, OIL_WELL, LUMBER_CAMP) produce raw resources per tick. These resources are shipped to the nearest city or idle factory via BFS over owned territory (max `CFG.SUPPLY_CHAIN.MAX_HOPS` = 6 hops), with a 15% distance penalty per hop.

See: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `tickExtractorOutput()`

### Factory Processing

Factories consume raw resources and produce processed resources after `ticksPerCycle` ticks. Output is then shipped to the nearest city.

See: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `tickFactoryProcessing()`, `tickFactoryOutputToCities()`

## Resource Consumption

### Population Upkeep

Each tick, cities consume resources based on population:
- **Food drain**: `population × CFG.CITY.FOOD_DRAIN_PER_POP` (0.1)
  - BREAD consumed first at 1:1
  - If BREAD is insufficient, GRAIN consumed at 1.5:1 emergency ratio
- **Energy drain**: `CFG.CITY.POWER_DRAIN_BASE` (0.3) + `(tier - 1) × 0.3` + `population × CFG.CITY.ENERGY_DRAIN_PER_POP` (0.05)
  - POWER consumed from stockpile

The `foodPerTick` and `energyPerTick` values on CityState are **satisfaction ratios** (0.0 to 1.0+), representing what fraction of demand is being met, NOT production rates. Displayed as percentages rounded to 1 decimal.

See: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `tickCityResourceDrain()`

### Food Value System

Resources have `foodValue` and `materialValue` weights that allow substitution:

| Resource | Food Value | Material Value |
|---|---|---|
| BREAD | 1.0 | — |
| GRAIN | 0.67 | — |
| OIL | 0.5 | — |
| ORE | — | 1.0 |
| STEEL | — | 1.5 |

When a unit costs FOOD:20, the city needs 20 "food value" units. This can be satisfied by any combination (e.g., 20 BREAD, 30 GRAIN, 40 OIL, or a mix). Same for MATERIAL costs with material values.

See: [`shared/src/constants.ts`](../shared/src/constants.ts) — `FOOD_VALUE`, `MATERIAL_VALUE`

## Unit Production

### Production Queue

Each city has two queues:
- **Priority queue**: One-shot items, processed first
- **Repeat queue**: Cycles infinitely — after completing an item, it rotates to the back

See: [`backend/src/mutations/cities.ts`](../backend/src/mutations/cities.ts) — `startNextProduction()`

### Per-Tick Resource Investment

Resources are consumed **gradually** during production, not all at once when the unit completes. Each tick, 1/`ticksCost` of the total cost is "invested" (reserved from the stockpile). This means:

1. `canCityAffordProduction()` checks that uninvested resources suffice for the remaining cost
2. `investProductionTick()` reserves a fraction of resources per tick
3. `consumeProductionCosts()` deducts the invested amounts when the unit completes

Invested amounts are tracked in `CityState.productionResourcesInvested` (JSON `Record<string, number>`). For FOOD/MATERIAL costs, individual resource reservations are tracked with suffixed keys (e.g., `"BREAD_FOOD"`, `"ORE_MATERIAL"`).

See: [`backend/src/mutations/cities.ts`](../backend/src/mutations/cities.ts) — `investProductionTick()`, `consumeProductionCosts()`, `canCityAffordProduction()`

### Unit Costs

Configured in `CFG.UNITS`:

| Unit | Ticks | Resource Cost | Manpower |
|---|---|---|---|
| INFANTRY | 100 | FOOD: 20 | 1 |
| ENGINEER | 300 | FOOD: 30 | 2 |

### Affordability

A city can produce a unit if:
1. It has enough un-invested food value in stockpile for the remaining FOOD cost
2. It has enough un-invested material value for the remaining MATERIAL cost
3. Population ≥ manpowerCost + 1 (need at least 1 pop to remain)

### On Completion

When production completes (`productionTicksRemaining` reaches 0):
1. Invested resources are deducted from stockpile
2. Manpower is deducted from population
3. A unit of the produced type spawns on the city's hex (if under `MAX_PER_HEX` limit)

See: [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts) — `processCityProduction()`

## Tick Order

The game tick processes systems in this order (see [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts) — `onTick()`):

1. Build timers (building construction)
2. City production (invest → tick → spawn completed units)
3. Unit movement
4. Claim timers
5. Passive expansion
6. Extractor output → cities/factories
7. Factory processing
8. Factory output → cities
9. City resource drain (base rates + population consumption)
10. Population growth/decline
11. City XP accumulation
12. Inflow window resets (every 100 ticks)
13. Elimination check
14. Broadcast state slices to players

## Configuration Reference

All configurable values are in `CFG` ([`shared/src/constants.ts`](../shared/src/constants.ts)):

| Constant | Default | Description |
|---|---|---|
| `CITY.BASE_GRAIN_RATE` | 1.0 | Grain generated per city per tick |
| `CITY.BASE_POWER_RATE` | 0.3 | Power generated per city per tick |
| `CITY.FOOD_DRAIN_PER_POP` | 0.1 | Food value consumed per population per tick |
| `CITY.ENERGY_DRAIN_PER_POP` | 0.05 | Power consumed per population per tick |
| `CITY.POWER_DRAIN_BASE` | 0.3 | Base power drain per tick (increases with tier) |
| `CITY.BREAD_EMERGENCY_GRAIN_RATIO` | 1.5 | Grain cost multiplier when bread runs out |
| `CITY.INFLOW_WINDOW_TICKS` | 100 | How often inflow tracking resets |
| `CITY.INITIAL_STOCKPILE` | BREAD:60, GRAIN:40, ORE:30, STEEL:10, POWER:10 | Starting resources for new cities |
| `CITY.POPULATION_INITIAL` | 10 | Starting population for new cities |
| `SUPPLY_CHAIN.MAX_HOPS` | 6 | Max BFS distance for resource shipping |
| `SUPPLY_CHAIN.DISTANCE_PENALTY` | 0.15 | Resource loss per hop (%) |
| `RESOURCE_CATEGORIES` | FOOD/INDUSTRY/ENERGY | Category groupings for display |