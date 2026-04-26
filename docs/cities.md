# Cities

> See also: [Storage & Production System](./storage-production.md) for detailed resource mechanics

## City Tiers

| Tier | Name | XP Required | Pop Cap | Manpower |
|---|---|---|---|---|
| 1 | Settlement | 0 | 50 | 2 |
| 2 | Village | 5,000 | 150 | 6 |
| 3 | Town | 15,000 | 400 | 15 |
| 4 | City | 40,000 | 1,000 | 35 |
| 5 | Metropolis | 100,000 | 3,000 | 90 |
| 6 | Megacity | 250,000 | 10,000 | 250 |

Constants: `CFG.CITY.TIER_XP_THRESHOLDS`, `CFG.CITY.TIER_MANPOWER` in [`shared/src/constants.ts`](../shared/src/constants.ts)

## Unit Production

Cities produce units via a priority/repeat queue system. Resources are invested gradually each tick (1/`ticksCost` per tick) rather than consumed all at once.

- **Priority queue**: one-shot items, processed first
- **Repeat queue**: cycles infinitely; rotates after completion
- Production starts automatically; if city can't afford remaining cost, it stalls
- When complete: invested resources deducted, manpower deducted from population, unit spawns

Source: [`backend/src/mutations/cities.ts`](../backend/src/mutations/cities.ts) — `tickCityProduction()`, `investProductionTick()`, `consumeProductionCosts()`

## City Data Model

```typescript
// shared/src/types.ts — CityData (client-facing)
interface CityData {
  cityId: string; ownerId: string; cellId: string;
  tier: number; xp: number; xpToNext: number; population: number;
  repeatQueue: string[]; priorityQueue: ProductionItem[];
  currentProduction: ProductionItem | null;
  productionTicksRemaining: number; productionTicksTotal: number;
  productionResourcesInvested: Record<string, number>;
  foodPerTick: number; energyPerTick: number; manpowerPerTick: number;
  stockpile: StockpileEntry[];
  resourceInflows: ResourceInflowEntry[];
}

// backend/src/state/CityState.ts — Colyseus schema (server state)
class CityState extends Schema {
  cityId, ownerId, cellId, tier, xp, population;
  repeatQueue, priorityQueue, currentProduction: string (JSON);
  productionTicksRemaining, productionTicksTotal: number;
  productionResourcesInvested: string (JSON Record<string, number>);
  foodPerTick, energyPerTick, manpowerPerTick: number;
  stockpile: string (JSON);
  resourceInflows: string (JSON ResourceInflowEntry[]);
  lastInflowResetTick: number;
  // ... other fields
}
```

## Resource Accrual

Cities generate base resources every tick:
- **Grain**: `CFG.CITY.BASE_GRAIN_RATE` (1.0) per tick
- **Power**: `CFG.CITY.BASE_POWER_RATE` (0.3) per tick

Extractors (FARM, MINE, OIL_WELL, LUMBER_CAMP) produce raw resources → shipped to nearest city via supply chain (BFS, max 6 hops, 15% penalty per hop).

Factories process raw → processed resources → shipped to nearest city.

Population consumes food and energy each tick. See [Storage & Production](./storage-production.md) for full details.

Source: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `tickCityResourceDrain()`, `tickExtractorOutput()`, `tickFactoryOutputToCities()`

## Population Growth

Population grows every tick based on food satisfaction:
- Growth: `POPULATION_GROWTH_BASE + POPULATION_GROWTH_FOOD_BONUS * foodSatisfaction` (when food ≥ 100%)
- Decline: `-POPULATION_DECLINE_RATE` when food < 50% satisfaction
- Starvation: `-POPULATION_STARVATION_RATE` when food = 0%
- Population capped by tier

Source: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `tickPopulation()`

## City XP

XP accumulates every tick:
- `baseXP = floor(population / 10) * XP_PER_POP_PER_10`
- Food satisfaction ≥ 1.0 → ×1.5 multiplier
- Energy satisfaction ≥ 1.0 → ×1.3 multiplier
- Tier upgrades automatically at thresholds

Source: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `tickCityXP()`

## Stockpile Display

The city panel shows stockpile resources grouped by category (Food, Industry, Energy) with category totals. Hovering on a category shows inflow details — sources and amounts added in the last 100 ticks. Values rounded to 1 decimal.

Source: [`frontend/src/ui/HUD.ts`](../frontend/src/ui/HUD.ts) — `renderCityPanel()`

## Rendering

City icons are 2D planes oriented radially outward. See [`frontend/src/systems/CityRenderer.ts`](../frontend/src/systems/CityRenderer.ts)