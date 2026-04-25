import { BiomeType, ResourceType, type BiomeConfig, type FogConfig, type GlobeConfig, type CameraConfig, TerrainType } from './types';

// ──────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────

export interface TerrainConfig {
  passable: boolean;
  cost: number;
  capacity: number;
  buildable: string[];
}

export interface UnitConfig {
  ticksCost: number;
  resourceCost: Record<string, number>;
  manpowerCost: number;
  buildable?: Record<string, { minLevel: number }>;
}

export interface BuildingConfig {
  ticks: number;
  placement: string[];
  extractorOutput: { resource: ResourceType; amount: number } | null;
  cost: { food: number; material: number; consumesEngineer: boolean };
}

export interface ResourceConfig {
  tier: 'raw' | 'processed';
  foodValue?: number;
  materialValue?: number;
  recipe?: {
    building: string;
    input: { resource: ResourceType; amount: number }[];
    output: { resource: ResourceType; amount: number }[];
    ticksPerCycle: number;
    minFactoryTier: number;
  };
}

export interface FactoryRecipeDef {
  id: string;
  name: string;
  input: { resource: ResourceType; amount: number }[];
  output: { resource: ResourceType; amount: number }[];
  ticksPerCycle: number;
  minFactoryTier: number;
}

export interface ICFG {
  BIOMES: BiomeConfig[];
  GLOBE: GlobeConfig;
  FOG: FogConfig;
  CAMERA: CameraConfig;
  CELL_COLOR_LERP: number;
  TERRAIN: Record<string, TerrainConfig>;
  TICK_RATE_MS: number;
  STARTING_TERRITORY_SIZE: number;
  VISION_RANGE: number;
  TROOP_VISION_RANGE: number;
  CLAIM: { TICKS_UNCLAIMED: number; TICKS_ENEMY: number };
  UNITS: Record<string, UnitConfig>;
  MAX_PER_HEX: number;
  ENGINEER_BUILD_TICKS: number;
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
    FOOD_DRAIN_PER_POP: number;
    POWER_DRAIN_BASE: number;
    BREAD_EMERGENCY_GRAIN_RATIO: number;
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
    RECIPES: FactoryRecipeDef[];
    XP_PER_CYCLE: number;
    TIER_THRESHOLDS: number[];
    BASE_XP: number;
  };
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
}

export interface IMATCHMAKING_CFG {
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  SUBDIVIDE_LEVEL: number;
  COUNTDOWN_SECONDS: number;
  RECONNECTION_WINDOW: number;
}

// ──────────────────────────────────────────────
// MATCHMAKING_CFG — separate, room-level config
// ──────────────────────────────────────────────

export const MATCHMAKING_CFG: IMATCHMAKING_CFG = {
  MIN_PLAYERS: 1,
  MAX_PLAYERS: 8,
  SUBDIVIDE_LEVEL: 3,
  COUNTDOWN_SECONDS: 5,
  RECONNECTION_WINDOW: 60,
};

// ──────────────────────────────────────────────
// CFG — Single configuration dictionary
// ──────────────────────────────────────────────

export const CFG: ICFG = {

  BIOMES: [
    { type: BiomeType.Ocean, color: '#2299cc', weight: 0.35 },
    { type: BiomeType.Plains, color: '#6aad4f', weight: 0.25 },
    { type: BiomeType.Forest, color: '#3d7a2a', weight: 0.18 },
    { type: BiomeType.Mountain, color: '#998877', weight: 0.10 },
    { type: BiomeType.Desert, color: '#ddbb6a', weight: 0.07 },
    { type: BiomeType.Tundra, color: '#bbdde6', weight: 0.05 },
  ],

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

  CELL_COLOR_LERP: 0.08,

  TICK_RATE_MS: 100,

  // ─── Terrain (dictionary per terrain type) ──
  TERRAIN: {
    PLAINS:   { passable: true,  cost: 30,   capacity: 6, buildable: ['FARM', 'FACTORY', 'CITY'] },
    FOREST:   { passable: true,  cost: 60,   capacity: 5, buildable: ['FARM', 'LUMBER_CAMP'] },
    MOUNTAIN: { passable: true,  cost: 90,   capacity: 3, buildable: ['MINE'] },
    DESERT:   { passable: true,  cost: 30,   capacity: 4, buildable: ['MINE', 'OIL_WELL', 'FACTORY', 'CITY'] },
    TUNDRA:   { passable: true,  cost: 60,   capacity: 4, buildable: ['OIL_WELL', 'LUMBER_CAMP', 'FACTORY'] },
    OCEAN:    { passable: false, cost: Infinity, capacity: 0, buildable: [] },
    PENTAGON: { passable: true,  cost: 30,   capacity: 5, buildable: ['FARM', 'MINE', 'OIL_WELL', 'LUMBER_CAMP', 'FACTORY'] },
  } as Record<string, TerrainConfig>,

  STARTING_TERRITORY_SIZE: 1,
  VISION_RANGE: 1,
  TROOP_VISION_RANGE: 1,

  CLAIM: {
    TICKS_UNCLAIMED: 50,
    TICKS_ENEMY: 3000,
  },

  // ─── Units (dictionary per unit type, buildable on engineer) ──
  UNITS: {
    INFANTRY: {
      ticksCost: 100,
      resourceCost: { FOOD: 20 } as Record<string, number>,
      manpowerCost: 1,
    },
    ENGINEER: {
      ticksCost: 300,
      resourceCost: { FOOD: 30 } as Record<string, number>,
      manpowerCost: 2,
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
  ENGINEER_BUILD_TICKS: 200,

  // ─── Buildings (dictionary per building type) ──
  BUILDINGS: {
    FARM:        { ticks: 200, placement: ['PLAINS', 'FOREST'],         extractorOutput: { resource: ResourceType.GRAIN,  amount: 3 }, cost: { food: 0,  material: 0,  consumesEngineer: false } },
    MINE:        { ticks: 300, placement: ['MOUNTAIN', 'DESERT'],       extractorOutput: { resource: ResourceType.ORE,    amount: 3 }, cost: { food: 0,  material: 0,  consumesEngineer: false } },
    OIL_WELL:    { ticks: 350, placement: ['DESERT', 'TUNDRA'],         extractorOutput: { resource: ResourceType.OIL,    amount: 2 }, cost: { food: 30, material: 20, consumesEngineer: true  } },
    LUMBER_CAMP: { ticks: 250, placement: ['FOREST', 'TUNDRA'],          extractorOutput: { resource: ResourceType.TIMBER, amount: 3 }, cost: { food: 0,  material: 0,  consumesEngineer: false } },
    FACTORY:     { ticks: 400, placement: ['PLAINS', 'DESERT', 'TUNDRA'], extractorOutput: null,                                              cost: { food: 50, material: 30, consumesEngineer: true  } },
    CITY:        { ticks: 500, placement: ['PLAINS', 'DESERT'],          extractorOutput: null,                                              cost: { food: 80, material: 40, consumesEngineer: true  } },
    RUIN_RESTORE:{ ticks: 400, placement: [],                            extractorOutput: null,                                              cost: { food: 0,  material: 0,  consumesEngineer: false } },
  },

  // ─── Resources (flat dictionary per resource type) ──
  RESOURCES: {
    GRAIN:  { tier: 'raw',       foodValue: 0.67 },
    ORE:    { tier: 'raw',       materialValue: 1.0 },
    OIL:    { tier: 'raw',       foodValue: 0.5 },
    TIMBER: { tier: 'raw' },
    BREAD:  { tier: 'processed', foodValue: 1.0,  recipe: { building: 'FACTORY', input: [{ resource: ResourceType.GRAIN,  amount: 3 }], output: [{ resource: ResourceType.BREAD, amount: 2 }], ticksPerCycle: 50, minFactoryTier: 1 } },
    STEEL:  { tier: 'processed', materialValue: 1.5, recipe: { building: 'FACTORY', input: [{ resource: ResourceType.ORE,    amount: 3 }], output: [{ resource: ResourceType.STEEL, amount: 2 }], ticksPerCycle: 60, minFactoryTier: 1 } },
    POWER:  { tier: 'processed', recipe: { building: 'FACTORY', input: [{ resource: ResourceType.OIL,    amount: 2 }], output: [{ resource: ResourceType.POWER, amount: 2 }], ticksPerCycle: 70, minFactoryTier: 1 } },
    LUMBER: { tier: 'processed', recipe: { building: 'FACTORY', input: [{ resource: ResourceType.TIMBER, amount: 3 }], output: [{ resource: ResourceType.LUMBER, amount: 2 }], ticksPerCycle: 45, minFactoryTier: 1 } },
  } as Record<string, ResourceConfig>,

  // ─── City / Settlement ────────────────────
  CITY: {
    INITIAL_STOCKPILE: { [ResourceType.BREAD]: 60, [ResourceType.GRAIN]: 40, [ResourceType.ORE]: 30, [ResourceType.STEEL]: 10, [ResourceType.POWER]: 10 } as Record<string, number>,
    POPULATION_INITIAL: 10,
    POPULATION_CAP: { 1: 50, 2: 150, 3: 400, 4: 1000, 5: 3000, 6: 10000 } as Record<number, number>,
    POPULATION_GROWTH_BASE: 0.002,
    POPULATION_GROWTH_FOOD_BONUS: 0.003,
    POPULATION_DECLINE_THRESHOLD: 0.5,
    POPULATION_DECLINE_RATE: 0.001,
    POPULATION_STARVATION_THRESHOLD: 0,
    POPULATION_STARVATION_RATE: 0.01,
    BASE_GRAIN_RATE: 0.5,
    FOOD_DRAIN_PER_POP: 0.1,
    POWER_DRAIN_BASE: 0.5,
    BREAD_EMERGENCY_GRAIN_RATIO: 1.5,
    TIER_XP_THRESHOLDS: [0, 5000, 15000, 40000, 100000, 250000],
    TIER_MANPOWER: { 1: 2, 2: 6, 3: 15, 4: 35, 5: 90, 6: 250 } as Record<number, number>,
    XP_PER_POP_PER_10: 1,
    XP_FOOD_MULTIPLIER: 1.5,
    XP_ENERGY_MULTIPLIER: 1.3,
    VALID_SPAWN_TERRAIN: [TerrainType.PLAINS] as TerrainType[],
    PASSIVE_EXPANSION_TICKS: { 1: 0, 2: 120, 3: 60, 4: 30, 5: 15, 6: 5 } as Record<number, number>,
  },

  // ─── Supply Chain ─────────────────────────
  SUPPLY_CHAIN: {
    MAX_HOPS: 6,
    DISTANCE_PENALTY: 0.15,
    ENERGY_PIPELINE_MAX_HOPS: 20,
  },

  // ─── Factory ──────────────────────────────
  FACTORY: {
    RECIPES: [
      { id: 'bake',   name: 'Bake Grain',   input: [{ resource: ResourceType.GRAIN,  amount: 3 }], output: [{ resource: ResourceType.BREAD, amount: 2 }], ticksPerCycle: 50, minFactoryTier: 1 },
      { id: 'smelt',  name: 'Smelt Ore',     input: [{ resource: ResourceType.ORE,    amount: 3 }], output: [{ resource: ResourceType.STEEL, amount: 2 }], ticksPerCycle: 60, minFactoryTier: 1 },
      { id: 'refine', name: 'Refine Oil',    input: [{ resource: ResourceType.OIL,    amount: 2 }], output: [{ resource: ResourceType.POWER, amount: 2 }], ticksPerCycle: 70, minFactoryTier: 1 },
      { id: 'mill',   name: 'Mill Timber',   input: [{ resource: ResourceType.TIMBER, amount: 3 }], output: [{ resource: ResourceType.LUMBER, amount: 2 }], ticksPerCycle: 45, minFactoryTier: 1 },
    ],
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
};

// ──────────────────────────────────────────────
// Derived helpers (computed once from CFG)
// ──────────────────────────────────────────────

export const PASSABLE_TERRAIN = (Object.entries(CFG.TERRAIN) as [string, TerrainConfig][])
  .filter(([, t]) => t.passable)
  .map(([k]) => k);

export const MOVEMENT_COST: Record<string, number> = {};
export const CELL_BUILDING_CAPACITY: Record<string, number> = {};
export const BUILDING_PLACEMENT_RULES: Record<string, string[]> = {};
export const TERRAIN_BUILDABLE: Record<string, string[]> = {};
for (const [key, t] of Object.entries(CFG.TERRAIN) as [string, TerrainConfig][]) {
  MOVEMENT_COST[key] = t.cost;
  CELL_BUILDING_CAPACITY[key] = t.capacity;
  TERRAIN_BUILDABLE[key] = t.buildable;
}

export const BUILDING_TICKS: Record<string, number> = {};
export const BUILDING_COSTS: Record<string, { food: number; material: number; consumesEngineer: boolean }> = {};
for (const [key, val] of Object.entries(CFG.BUILDINGS) as [string, BuildingConfig][]) {
  BUILDING_TICKS[key] = val.ticks;
  BUILDING_COSTS[key] = { food: val.cost.food, material: val.cost.material, consumesEngineer: val.cost.consumesEngineer };
  if (val.placement.length > 0) BUILDING_PLACEMENT_RULES[key] = [...val.placement];
}

export const EXTRACTOR_OUTPUT: Record<string, { resource: ResourceType; amount: number }> = {};
export const EXTRACTOR_TYPES: string[] = [];
for (const [key, val] of Object.entries(CFG.BUILDINGS) as [string, BuildingConfig][]) {
  if (val.extractorOutput) {
    EXTRACTOR_OUTPUT[key] = { resource: val.extractorOutput.resource, amount: val.extractorOutput.amount };
  }
  if (val.extractorOutput && !val.cost.consumesEngineer && key !== 'FACTORY' && key !== 'CITY' && key !== 'RUIN_RESTORE') {
    EXTRACTOR_TYPES.push(key);
  }
}

export const FOOD_VALUE: Record<string, number> = {};
export const MATERIAL_VALUE: Record<string, number> = {};
export const RAW_RESOURCES: ResourceType[] = [];
export const PROCESSED_RESOURCES: ResourceType[] = [];
for (const [key, val] of Object.entries(CFG.RESOURCES) as [string, ResourceConfig][]) {
  if (val.foodValue !== undefined && val.foodValue > 0) FOOD_VALUE[key] = val.foodValue;
  if (val.materialValue !== undefined && val.materialValue > 0) MATERIAL_VALUE[key] = val.materialValue;
  if (val.tier === 'raw') RAW_RESOURCES.push(key as ResourceType);
  if (val.tier === 'processed') PROCESSED_RESOURCES.push(key as ResourceType);
}

export const UNIT_PRODUCTION_COSTS: { type: string; ticksCost: number; resourceCost: Record<string, number>; manpowerCost: number }[] = [];
for (const [key, val] of Object.entries(CFG.UNITS) as [string, UnitConfig][]) {
  UNIT_PRODUCTION_COSTS.push({ type: key, ticksCost: val.ticksCost, resourceCost: { ...val.resourceCost }, manpowerCost: val.manpowerCost });
}

export function getEngineerBuildableTypes(engineerLevel: number): string[] {
  const engineer = CFG.UNITS['ENGINEER'];
  if (!engineer?.buildable) return [];
  const result: string[] = [];
  for (const [buildingType, req] of Object.entries(engineer.buildable)) {
    if (req.minLevel <= engineerLevel) result.push(buildingType);
  }
  return result;
}