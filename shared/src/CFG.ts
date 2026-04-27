import { TerrainType, ResourceType, type FogConfig, type GlobeConfig, type CameraConfig } from './types';

// ──────────────────────────────────────────────
// This file contains ONLY the CFG object and its
// interfaces — all gameplay-tunable values in one
// place.  No derived data, no side effects.
//
//   ✅  CFG.UNITS.INFANTRY.buildable
//   ✅  CFG.RESOURCES.BREAD.recipe
//   ✅  CFG.CITY.BASE_GRAIN_RATE
//
//   ❌  Separate top-level const for gameplay data
//   ❌  Duplicated data (e.g. FACTORY.RECIPES that
//       mirrors RESOURCES.*.recipe)
//   ❌  Derived / computed values (use cfgHelpers.ts)
//   ❌  Magic numbers scattered in mutations/
//
// Recipes are defined on the processed resource
// (CFG.RESOURCES.BREAD.recipe), not duplicated in
// FACTORY.RECIPES.  Factory recipes are derived via
// getFactoryRecipes(cfg) in cfgHelpers.ts.
//
// Resource categories are derived from the .category
// field on each resource.  Use getResourceCategories(cfg)
// and getResourceCategoryMap(cfg) in cfgHelpers.ts.
//
// Unit-specific data (e.g. buildable types) belongs
// on that unit's config inside CFG.UNITS.  Use the
// DRY helper getUnitBuildableTypes(cfg, type, level)
// in cfgHelpers.ts — never duplicate per-unit logic.
//
// Matchmaking config lives in matchmaking.ts since
// it is server-only and not part of the game state.
// ──────────────────────────────────────────────

export interface TerrainConfig {
  color: string;
  weight: number;
  passable: boolean;
  cost: number;
  capacity: number;
}

export interface UnitConfig {
  ticksCost: number;
  resourceCost: Record<string, number>;
  manpowerCost: number;
  visionRange: number;
  buildable?: Record<string, { minLevel: number }>;
}

export interface BuildingConfig {
  ticks: number;
  placement: string[];
  extractorOutput: { resource: ResourceType; amount: number } | null;
  cost: { food: number; material: number; consumesBuilder: boolean };
}

export interface ResourceConfig {
  tier: 'raw' | 'processed';
  foodValue?: number;
  materialValue?: number;
  category?: string;
  recipe?: {
    id?: string;
    name?: string;
    building: string;
    input: { resource: ResourceType; amount: number }[];
    output: { resource: ResourceType; amount: number }[];
    ticksPerCycle: number;
    minFactoryTier: number;
  };
}

export interface ICFG {
  TERRAIN: Record<string, TerrainConfig>;
  GLOBE: GlobeConfig;
  FOG: FogConfig;
  CAMERA: CameraConfig;
  TICK_RATE_MS: number;
  CLAIM: { TICKS_UNCLAIMED: number; TICKS_ENEMY: number };
  UNITS: Record<string, UnitConfig>;
  MAX_PER_HEX: number;
  BUILDINGS: Record<string, BuildingConfig>;
  RESOURCES: Record<string, ResourceConfig>;
  CITY: {
    INITIAL_STOCKPILE: Record<string, number>;
    POPULATION_INITIAL: number;
    POPULATION_CAP: Record<number, number>;
    POPULATION_GROWTH_BASE: number;
    POPULATION_GROWTH_FOOD_BONUS: number;
    POPULATION_DECLINE_THRESHOLD: number;
    POPULATION_DECLINE_RATE: number;
    POPULATION_STARVATION_THRESHOLD: number;
    POPULATION_STARVATION_RATE: number;
    BASE_GRAIN_RATE: number;
    BASE_POWER_RATE: number;
    FOOD_DRAIN_PER_POP: number;
    ENERGY_DRAIN_PER_POP: number;
    POWER_DRAIN_BASE: number;
    BREAD_EMERGENCY_GRAIN_RATIO: number;
    INFLOW_WINDOW_TICKS: number;
    TIER_XP_THRESHOLDS: number[];
    TIER_MANPOWER: Record<number, number>;
    XP_PER_POP_PER_10: number;
    XP_FOOD_MULTIPLIER: number;
    XP_ENERGY_MULTIPLIER: number;
    VALID_SPAWN_TERRAIN: TerrainType[];
    PASSIVE_EXPANSION_TICKS: Record<number, number>;
  };
  SUPPLY_CHAIN: {
    MAX_HOPS: number;
    DISTANCE_PENALTY: number;
    ENERGY_PIPELINE_MAX_HOPS: number;
  };
  FACTORY: {
    XP_PER_CYCLE: number;
    TIER_THRESHOLDS: number[];
    BASE_XP: number;
  };
  RESOURCE_CATEGORY_LABELS: Record<string, string>;
  DAY_NIGHT: {
    CYCLE_TICKS: number;
    SUN_INTENSITY: number;
    AMBIENT_DAY_INTENSITY: number;
    AMBIENT_NIGHT_INTENSITY: number;
    CITY_GLOW_INTENSITY: number;
    CITY_GLOW_COLOR: string;
    NIGHT_COLOR_MIX: number;
  };
  STOCKPILE_RAID_FRACTION: number;
  ENERGY_CREDITS_INITIAL: number;
  PLAYER_COLORS: string[];
  RUIN_TYPE_TO_BUILDING: Record<string, string>;
}

// ──────────────────────────────────────────────
// CFG — Single configuration dictionary
// ──────────────────────────────────────────────

export const CFG: ICFG = {

  // ─── Terrain (merged biome + terrain config) ──
  TERRAIN: {
    OCEAN:    { color: '#2299cc', weight: 0.35, passable: false, cost: Infinity, capacity: 0 },
    PLAINS:   { color: '#6aad4f', weight: 0.25, passable: true,  cost: 30,   capacity: 6 },
    FOREST:   { color: '#3d7a2a', weight: 0.18, passable: true,  cost: 60,   capacity: 5 },
    MOUNTAIN: { color: '#998877', weight: 0.10, passable: true,  cost: 90,   capacity: 3 },
    DESERT:   { color: '#ddbb6a', weight: 0.07, passable: true,  cost: 30,   capacity: 4 },
    TUNDRA:   { color: '#bbdde6', weight: 0.05, passable: true,  cost: 60,   capacity: 4 },
    PENTAGON: { color: '#557788', weight: 0,    passable: true,  cost: 30,   capacity: 5 },
  } as Record<string, TerrainConfig>,

  GLOBE: {
    radius: 5,
    subdivideLevel: 3,
    borderWidth: 0.3,
  },

  FOG: {
    unexploredColor: '#0a0a0a',
    unexploredOpacity: 0.95,
    exploredSaturation: 0.25,
    exploredBrightness: 0.35,
    revealedCellCount: 7,
    revealAnimationMs: 300,
  },

  CAMERA: {
    minDistance: 7,
    maxDistance: 25,
    rotationDamping: 0.92,
    zoomSpeed: 1.0,
    keyboardRotateSpeed: 2.5,
  },

  TICK_RATE_MS: 100,

  CLAIM: {
    TICKS_UNCLAIMED: 50,
    TICKS_ENEMY: 3000,
  },

  // ─── Units (dictionary per unit type) ──
  UNITS: {
    INFANTRY: {
      ticksCost: 100,
      resourceCost: { FOOD: 20 } as Record<string, number>,
      manpowerCost: 1,
      visionRange: 1,
      buildable: {
        FARM:        { minLevel: 1 },
        MINE:        { minLevel: 1 },
        LUMBER_CAMP: { minLevel: 1 },
        RUIN_RESTORE:{ minLevel: 1 },
      },
    },
    ENGINEER: {
      ticksCost: 300,
      resourceCost: { FOOD: 30 } as Record<string, number>,
      manpowerCost: 2,
      visionRange: 1,
      buildable: {
        FARM:        { minLevel: 1 },
        MINE:        { minLevel: 1 },
        OIL_WELL:    { minLevel: 1 },
        LUMBER_CAMP: { minLevel: 1 },
        RUIN_RESTORE:{ minLevel: 1 },
        FACTORY:     { minLevel: 2 },
        CITY:        { minLevel: 2 },
      },
    },
  },

  MAX_PER_HEX: 3,

  // ─── Buildings (dictionary per building type) ──
  BUILDINGS: {
    FARM:        { ticks: 200, placement: ['PLAINS', 'FOREST'],         extractorOutput: { resource: ResourceType.GRAIN,  amount: 3 }, cost: { food: 0,  material: 0,  consumesBuilder: true  } },
    MINE:        { ticks: 300, placement: ['MOUNTAIN', 'DESERT'],       extractorOutput: { resource: ResourceType.ORE,    amount: 3 }, cost: { food: 0,  material: 0,  consumesBuilder: true  } },
    OIL_WELL:    { ticks: 350, placement: ['DESERT', 'TUNDRA'],         extractorOutput: { resource: ResourceType.OIL,    amount: 2 }, cost: { food: 30, material: 20, consumesBuilder: true  } },
    LUMBER_CAMP: { ticks: 250, placement: ['FOREST', 'TUNDRA'],          extractorOutput: { resource: ResourceType.TIMBER, amount: 3 }, cost: { food: 0,  material: 0,  consumesBuilder: true  } },
    FACTORY:     { ticks: 400, placement: ['PLAINS', 'DESERT', 'TUNDRA'], extractorOutput: null,                                              cost: { food: 50, material: 30, consumesBuilder: true  } },
    CITY:        { ticks: 500, placement: ['PLAINS', 'DESERT'],          extractorOutput: null,                                              cost: { food: 80, material: 40, consumesBuilder: true  } },
    RUIN_RESTORE:{ ticks: 400, placement: [],                            extractorOutput: null,                                              cost: { food: 0,  material: 0,  consumesBuilder: false } },
  },

  // ─── Resources (flat dictionary per resource type) ──
  // Recipes are defined on the processed resource, not in FACTORY.RECIPES.
  RESOURCES: {
    GRAIN:  { tier: 'raw',       foodValue: 0.67,  category: 'FOOD' },
    ORE:    { tier: 'raw',       materialValue: 1.0, category: 'INDUSTRY' },
    OIL:    { tier: 'raw',       foodValue: 0.5,   category: 'ENERGY' },
    TIMBER: { tier: 'raw',                          category: 'INDUSTRY' },
    BREAD:  { tier: 'processed', foodValue: 1.0,   category: 'FOOD',    recipe: { id: 'bake', name: 'Bake Grain', building: 'FACTORY', input: [{ resource: ResourceType.GRAIN,  amount: 3 }], output: [{ resource: ResourceType.BREAD, amount: 2 }], ticksPerCycle: 50, minFactoryTier: 1 } },
    STEEL:  { tier: 'processed', materialValue: 1.5, category: 'INDUSTRY', recipe: { id: 'smelt', name: 'Smelt Ore', building: 'FACTORY', input: [{ resource: ResourceType.ORE,    amount: 3 }], output: [{ resource: ResourceType.STEEL, amount: 2 }], ticksPerCycle: 60, minFactoryTier: 1 } },
    POWER:  { tier: 'processed',                    category: 'ENERGY',  recipe: { id: 'refine', name: 'Refine Oil', building: 'FACTORY', input: [{ resource: ResourceType.OIL,    amount: 2 }], output: [{ resource: ResourceType.POWER, amount: 2 }], ticksPerCycle: 70, minFactoryTier: 1 } },
    LUMBER: { tier: 'processed',                    category: 'INDUSTRY', recipe: { id: 'mill', name: 'Mill Timber', building: 'FACTORY', input: [{ resource: ResourceType.TIMBER, amount: 3 }], output: [{ resource: ResourceType.LUMBER, amount: 2 }], ticksPerCycle: 45, minFactoryTier: 1 } },
  } as Record<string, ResourceConfig>,

  // ─── City / Settlement ────────────────────
  CITY: {
    INITIAL_STOCKPILE: { [ResourceType.BREAD]: 80, [ResourceType.GRAIN]: 60, [ResourceType.ORE]: 30, [ResourceType.STEEL]: 10, [ResourceType.POWER]: 20 } as Record<string, number>,
    POPULATION_INITIAL: 10,
    POPULATION_CAP: { 1: 50, 2: 150, 3: 400, 4: 1000, 5: 3000, 6: 10000 } as Record<number, number>,
    POPULATION_GROWTH_BASE: 0.002,
    POPULATION_GROWTH_FOOD_BONUS: 0.003,
    POPULATION_DECLINE_THRESHOLD: 0.5,
    POPULATION_DECLINE_RATE: 0.001,
    POPULATION_STARVATION_THRESHOLD: 0,
    POPULATION_STARVATION_RATE: 0.01,
    BASE_GRAIN_RATE: 2.0,
    BASE_POWER_RATE: 0.5,
    FOOD_DRAIN_PER_POP: 0.08,
    ENERGY_DRAIN_PER_POP: 0.03,
    POWER_DRAIN_BASE: 0.3,
    BREAD_EMERGENCY_GRAIN_RATIO: 1.5,
    INFLOW_WINDOW_TICKS: 100,
    TIER_XP_THRESHOLDS: [0, 5000, 15000, 40000, 100000, 250000],
    TIER_MANPOWER: { 1: 2, 2: 6, 3: 15, 4: 35, 5: 90, 6: 250 } as Record<number, number>,
    XP_PER_POP_PER_10: 1,
    XP_FOOD_MULTIPLIER: 1.5,
    XP_ENERGY_MULTIPLIER: 1.3,
    VALID_SPAWN_TERRAIN: [TerrainType.PLAINS] as TerrainType[],
    PASSIVE_EXPANSION_TICKS: { 1: 0, 2: 120, 3: 60, 4: 30, 5: 15, 6: 5 } as Record<number, number>,
  },

  // ─── Resource Category Labels ──────────────
  RESOURCE_CATEGORY_LABELS: {
    FOOD: 'Food',
    INDUSTRY: 'Industry',
    ENERGY: 'Energy',
  },

  // ─── Supply Chain ─────────────────────────
  SUPPLY_CHAIN: {
    MAX_HOPS: 6,
    DISTANCE_PENALTY: 0.15,
    ENERGY_PIPELINE_MAX_HOPS: 20,
  },

  // ─── Factory ──────────────────────────────
  FACTORY: {
    XP_PER_CYCLE: 10,
    TIER_THRESHOLDS: [0, 100, 500, 2000, 10000],
    BASE_XP: 0,
  },

  // ─── Day / Night ─────────────────────────
  DAY_NIGHT: {
    CYCLE_TICKS: 1800,
    SUN_INTENSITY: 1.5,
    AMBIENT_DAY_INTENSITY: 1.2,
    AMBIENT_NIGHT_INTENSITY: 0.25,
    CITY_GLOW_INTENSITY: 0.4,
    CITY_GLOW_COLOR: '#ffcc44',
    NIGHT_COLOR_MIX: 0.25,
  },

  // ─── Misc ─────────────────────────────────
  STOCKPILE_RAID_FRACTION: 0.5,
  ENERGY_CREDITS_INITIAL: 50,
  PLAYER_COLORS: [
    '#4488ff',
    '#ff4444',
    '#44cc44',
    '#ffaa00',
    '#cc44cc',
    '#44cccc',
    '#ff8844',
    '#8844ff',
  ],
  RUIN_TYPE_TO_BUILDING: {
    RUINED_FACTORY: 'FACTORY',
    COLLAPSED_MINE: 'MINE',
    OVERGROWN_FARM: 'FARM',
    RUINED_BARRACKS: 'FARM',
    RUINED_PORT: 'FACTORY',
    RUINED_CITY: 'CITY',
  },
};