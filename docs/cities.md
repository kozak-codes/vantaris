# Cities

## City Tiers

| Tier | Name | XP Required | Pop Cap | Manpower/tick | Food/tick | Energy/tick |
|---|---|---|---|---|---|---|
| 1 | Settlement | 0 | 50 | 2 | 1 | 1 |
| 2 | Village | 5,000 | 150 | 6 | 3 | 2 |
| 3 | Town | 15,000 | 400 | 15 | 8 | 5 |
| 4 | City | 40,000 | 1,000 | 35 | 20 | 12 |
| 5 | Metropolis | 100,000 | 3,000 | 90 | 55 | 30 |
| 6 | Megacity | 250,000 | 10,000 | 250 | 150 | 80 |

Constants: `CITY_TIER_XP_THRESHOLDS`, `CITY_TIER_MANPOWER`, `CITY_FOOD_COST`, `CITY_ENERGY_COST` in [`shared/src/constants.ts`](../shared/src/constants.ts)

## Unit Production

- Cities can produce infantry units
- Production time: `CITY_TROOP_PRODUCTION_TICKS = 100` ticks (10 seconds)
- Toggle production on/off via `toggleCityProduction` message
- Source: [`backend/src/mutations/cities.ts`](../backend/src/mutations/cities.ts) — `tickCityProduction()`

### Spawn Rules

- Produced units appear on the city's hex
- If hex is at `MAX_UNITS_PER_HEX` capacity, unit is not spawned (production tick is consumed)
- Source: [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts) — `processCityProduction()`

## City Data Model

```typescript
// shared/src/types.ts
interface CityData {
  cityId: string
  ownerId: string
  cellId: string
  tier: number
  xp: number
  xpToNext: number
  population: number
  producingUnit: boolean
  producingType: string       // "INFANTRY" or "ENGINEER"
  productionTicksRemaining: number
  foodPerTick: number
  energyPerTick: number
  manpowerPerTick: number
}

// backend/src/state/CityState.ts — Colyseus schema
class CityState extends Schema {
  cityId: string
  ownerId: string
  cellId: string
  tier: number
  xp: number
  population: number
  productionTicksRemaining: number
  producingUnit: boolean
  producingType: string      // "INFANTRY" or "ENGINEER"
  energyCredits: number
  factoryRecipe: string
  factoryXPMap: string   // JSON map of recipe → XP
  passiveExpandCooldown: number
  foodPerTick: number
  energyPerTick: number
  manpowerPerTick: number
}
```

## Resource Accrual

Cities generate resources every tick:
- **Food**: base from tier (`CITY_FOOD_COST`) + bonuses from farms and territory resources
- **Energy**: base from tier (`CITY_ENERGY_COST`) + bonuses from power plants and ore territory
- **Manpower**: from tier (`CITY_TIER_MANPOWER`)

Buildings and territory resources only contribute if connected to the city via contiguous owned territory (flood fill, max 20 hops).

Source: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `computeCityResourceRates()`, `tickResources()`

## Population Growth

Population grows every tick based on food satisfaction:
- Growth: `POPULATION_GROWTH_BASE + POPULATION_GROWTH_FOOD_BONUS * foodSatisfaction` (when food fully satisfied)
- Decline: `-POPULATION_DECLINE_RATE` when food below 50% satisfaction
- Starvation: `-POPULATION_STARVATION_RATE` when food = 0
- Population capped by tier (` Settlement=50, Village=150, Town=400, City=1000, Metropolis=3000, Megacity=10000`)
- Pop values stored as floats, displayed as floor()

Source: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `tickPopulation()`

## City XP

XP accumulates every tick:
- `baseXP = floor(population / 10) * CITY_XP_PER_POP_PER_10`
- Food satisfaction ≥ 1.0 → ×1.5 multiplier
- Energy satisfaction ≥ 1.0 → ×1.3 multiplier
- Tier upgrades automatically when XP reaches threshold

Source: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `tickCityXP()`

## Resource Stockpiles

Each player has food/energy/manpower stockpiles (`PlayerState`). On city capture, `raidStockpiles()` transfers 50% of target's resources to raider.

Source: [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — `raidStockpiles()`

## Rendering

- City icons are 2D planes oriented radially outward (same system as units)
- Created via IconFactory: [`frontend/src/systems/IconFactory.ts`](../frontend/src/systems/IconFactory.ts)
- Only rendered on visible cells
- Source: [`frontend/src/systems/CityRenderer.ts`](../frontend/src/systems/CityRenderer.ts)

## Future: City Growth Model

```
XP/tick = base_rate × food_satisfaction × energy_satisfaction × happiness_modifier
```

| Source | Effect |
|---|---|
| Population existing | +1 XP per 10 citizens/tick |
| Food fully satisfied | ×1.5 multiplier |
| Energy fully satisfied | ×1.3 multiplier |
| Trade activity nearby | +2 XP per completed trade |
| Under siege | ×0.2 multiplier |

## Future: City Stacking

Two cities on the same hex combine into the next tier, inheriting combined XP. Caps at tier 6. Requires an engineer.

## Future: City Decline

| Condition | Effect |
|---|---|
| Food < 50% for 60 ticks | Population shrinks, XP frozen |
| Food = 0 for 120 ticks | Tier drops by 1, XP loss |
| Energy = 0 for 30 ticks | All production halts |
| Unrest for 180 ticks | Revolt — rebel units spawn |

## Future: Building Slot System

Each hex has one building slot. Same-type buildings stack (upgrade tier). Different types combine into hybrids. Buildings unlock based on city tier. See main GDD for full building combinations table.