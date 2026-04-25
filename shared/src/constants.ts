import { BiomeType, ResourceType, type BiomeConfig, type FogConfig, type GlobeConfig, type CameraConfig, TerrainType } from './types';

// ──────────────────────────────────────────────
// CFG — Single configuration dictionary
// All game parameters live here. Re-exported as
// individual constants below for convenience.
// ──────────────────────────────────────────────

export const CFG = {

  // ─── World Generation ──────────────────────
  BIOMES: [
    { type: BiomeType.Ocean, color: '#2299cc', weight: 0.35 },
    { type: BiomeType.Plains, color: '#6aad4f', weight: 0.25 },
    { type: BiomeType.Forest, color: '#3d7a2a', weight: 0.18 },
    { type: BiomeType.Mountain, color: '#998877', weight: 0.10 },
    { type: BiomeType.Desert, color: '#ddbb6a', weight: 0.07 },
    { type: BiomeType.Tundra, color: '#bbdde6', weight: 0.05 },
  ] as BiomeConfig[],

  GLOBE: {
    radius: 5,
    subdivideLevel: 3,
    borderWidth: 0.3,
  } as GlobeConfig,

  FOG: {
    unexploredColor: '#0a0a0a',
    unexploredOpacity: 0.95,
    exploredSaturation: 0.25,
    exploredBrightness: 0.35,
    revealedCellCount: 7,
    revealAnimationMs: 300,
  } as FogConfig,

  CAMERA: {
    minDistance: 7,
    maxDistance: 25,
    rotationDamping: 0.92,
    zoomSpeed: 1.0,
    keyboardRotateSpeed: 2.5,
  } as CameraConfig,

  CELL_COLOR_LERP: 0.08,

  // ─── Matchmaking / Room ───────────────────
  QUEUE: {
    minPlayers: 1,
    maxPlayers: 8,
    subdivideLevel: 3,
  },

  TICK_RATE_MS: 100,
  MATCHMAKING_COUNTDOWN_SECONDS: 5,
  RECONNECTION_WINDOW: 60,

  // ─── Terrain ──────────────────────────────
  TERRAIN: {
    PASSABLE: [TerrainType.PLAINS, TerrainType.FOREST, TerrainType.MOUNTAIN, TerrainType.DESERT, TerrainType.TUNDRA] as TerrainType[],
    IMPASSABLE: [TerrainType.OCEAN] as TerrainType[],
    MOVEMENT_COST: {
      PLAINS: 30,
      DESERT: 30,
      FOREST: 60,
      MOUNTAIN: 90,
      TUNDRA: 60,
      OCEAN: Infinity,
    },
  },

  // ─── Vision / Territory ───────────────────
  STARTING_TERRITORY_SIZE: 1,
  VISION_RANGE: 1,
  TROOP_VISION_RANGE: 1,

  CLAIM: {
    TICKS_UNCLAIMED: 50,
    TICKS_ENEMY: 3000,
  },

  // ─── Units ────────────────────────────────
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
    },
    MAX_PER_HEX: 3,
    ENGINEER_BUILD_TICKS: 200,
  } as const,

  // ─── Buildings ───────────────────────────
  BUILDINGS: {
    FARM:        { ticks: 200, placement: ['PLAINS', 'FOREST'],         extractorOutput: { resource: ResourceType.GRAIN,  amount: 3 }, cost: { food: 0,  material: 0,  consumesEngineer: false } },
    MINE:        { ticks: 300, placement: ['MOUNTAIN', 'DESERT'],       extractorOutput: { resource: ResourceType.ORE,    amount: 3 }, cost: { food: 0,  material: 0,  consumesEngineer: false } },
    OIL_WELL:    { ticks: 350, placement: ['DESERT', 'TUNDRA'],         extractorOutput: { resource: ResourceType.OIL,    amount: 2 }, cost: { food: 30, material: 20, consumesEngineer: true  } },
    LUMBER_CAMP: { ticks: 250, placement: ['FOREST', 'TUNDRA'],          extractorOutput: { resource: ResourceType.TIMBER, amount: 3 }, cost: { food: 0,  material: 0,  consumesEngineer: false } },
    FACTORY:     { ticks: 400, placement: ['PLAINS', 'DESERT', 'TUNDRA'], extractorOutput: null,                                              cost: { food: 50, material: 30, consumesEngineer: true  } },
    CITY:        { ticks: 500, placement: ['PLAINS', 'DESERT'],          extractorOutput: null,                                              cost: { food: 80, material: 40, consumesEngineer: true  } },
    RUIN_RESTORE:{ ticks: 400, placement: [],                            extractorOutput: null,                                              cost: { food: 0,  material: 0,  consumesEngineer: false } },
  } as const,

  CELL_CAPACITY: {
    PLAINS: 6,
    FOREST: 5,
    MOUNTAIN: 3,
    DESERT: 4,
    TUNDRA: 4,
    OCEAN: 0,
    PENTAGON: 5,
  },

  ENGINEER_LEVEL_BUILD_RULES: {
    1: ['FARM', 'MINE', 'OIL_WELL', 'LUMBER_CAMP'],
    2: ['FARM', 'MINE', 'OIL_WELL', 'LUMBER_CAMP', 'FACTORY', 'CITY'],
  } as Record<number, string[]>,

  // ─── Resources ────────────────────────────
  RESOURCES: {
    FOOD_VALUE: {
      GRAIN: 0.67,
      BREAD: 1.0,
      OIL: 0.5,
    } as Record<string, number>,
    MATERIAL_VALUE: {
      ORE: 1.0,
      STEEL: 1.5,
    } as Record<string, number>,
    RAW: [ResourceType.GRAIN, ResourceType.ORE, ResourceType.OIL, ResourceType.TIMBER] as ResourceType[],
    PROCESSED: [ResourceType.BREAD, ResourceType.STEEL, ResourceType.POWER, ResourceType.LUMBER] as ResourceType[],
    EXTRACTOR_TYPES: ['FARM', 'MINE', 'OIL_WELL', 'LUMBER_CAMP'] as string[],
    ENGINEER_CONSUMABLE_TYPES: ['OIL_WELL', 'FACTORY', 'CITY'] as string[],
  },

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
  ENERGY_CREDITS_INITIAL: 0,
} as const;

// ──────────────────────────────────────────────
// Re-exports as flat constants (backward compat)
// ──────────────────────────────────────────────

export const BIOME_CONFIGS = CFG.BIOMES;
export const GLOBE_CONFIG = CFG.GLOBE;
export const FOG_CONFIG = CFG.FOG;
export const CAMERA_CONFIG = CFG.CAMERA;
export const CELL_COLOR_LERP = CFG.CELL_COLOR_LERP;
export const QUEUE_CONFIG = CFG.QUEUE;
export const TICK_RATE_MS = CFG.TICK_RATE_MS;
export const MATCHMAKING_COUNTDOWN_SECONDS = CFG.MATCHMAKING_COUNTDOWN_SECONDS;
export const RECONNECTION_WINDOW = CFG.RECONNECTION_WINDOW;
export const STARTING_TERRITORY_SIZE = CFG.STARTING_TERRITORY_SIZE;
export const VISION_RANGE = CFG.VISION_RANGE;
export const TROOP_VISION_RANGE = CFG.TROOP_VISION_RANGE;
export const PASSABLE_TERRAIN = CFG.TERRAIN.PASSABLE;
export const IMPASSABLE_TERRAIN = CFG.TERRAIN.IMPASSABLE;
export const MOVEMENT_COST = CFG.TERRAIN.MOVEMENT_COST;
export const CITY_TROOP_PRODUCTION_TICKS = CFG.UNITS.INFANTRY.ticksCost;
export const ENGINEER_PRODUCTION_TICKS = CFG.UNITS.ENGINEER.ticksCost;
export const MAX_UNITS_PER_HEX = CFG.UNITS.MAX_PER_HEX;
export const ENGINEER_BUILD_TICKS = CFG.UNITS.ENGINEER_BUILD_TICKS;
export const CLAIM_TICKS_UNCLAIMED = CFG.CLAIM.TICKS_UNCLAIMED;
export const CLAIM_TICKS_ENEMY = CFG.CLAIM.TICKS_ENEMY;
export const VALID_CITY_SPAWN_TERRAIN = CFG.CITY.VALID_SPAWN_TERRAIN;
export const PASSIVE_EXPANSION_TICKS = CFG.CITY.PASSIVE_EXPANSION_TICKS;

// Unit production costs (flat array, derived from CFG)
export interface UnitProductionCost { type: string; ticksCost: number; resourceCost: Record<string, number>; manpowerCost: number; }
export const UNIT_PRODUCTION_COSTS: UnitProductionCost[] = [
  { type: 'INFANTRY', ...CFG.UNITS.INFANTRY },
  { type: 'ENGINEER', ...CFG.UNITS.ENGINEER },
];

// City constants
export const CITY_POPULATION_INITIAL = CFG.CITY.POPULATION_INITIAL;
export const POPULATION_GROWTH_BASE = CFG.CITY.POPULATION_GROWTH_BASE;
export const POPULATION_GROWTH_FOOD_BONUS = CFG.CITY.POPULATION_GROWTH_FOOD_BONUS;
export const POPULATION_DECLINE_THRESHOLD = CFG.CITY.POPULATION_DECLINE_THRESHOLD;
export const POPULATION_DECLINE_RATE = CFG.CITY.POPULATION_DECLINE_RATE;
export const POPULATION_STARVATION_THRESHOLD = CFG.CITY.POPULATION_STARVATION_THRESHOLD;
export const POPULATION_STARVATION_RATE = CFG.CITY.POPULATION_STARVATION_RATE;
export const CITY_BASE_GRAIN_RATE = CFG.CITY.BASE_GRAIN_RATE;
export const CITY_FOOD_DRAIN_PER_POP = CFG.CITY.FOOD_DRAIN_PER_POP;
export const CITY_POWER_DRAIN_BASE = CFG.CITY.POWER_DRAIN_BASE;
export const CITY_BREAD_EMERGENCY_GRAIN_RATIO = CFG.CITY.BREAD_EMERGENCY_GRAIN_RATIO;
export const CITY_TIER_XP_THRESHOLDS = CFG.CITY.TIER_XP_THRESHOLDS;
export const CITY_TIER_MANPOWER = CFG.CITY.TIER_MANPOWER;
export const CITY_XP_PER_POP_PER_10 = CFG.CITY.XP_PER_POP_PER_10;
export const CITY_XP_FOOD_MULTIPLIER = CFG.CITY.XP_FOOD_MULTIPLIER;
export const CITY_XP_ENERGY_MULTIPLIER = CFG.CITY.XP_ENERGY_MULTIPLIER;
export const CITY_INITIAL_STOCKPILE = CFG.CITY.INITIAL_STOCKPILE;
export const CITY_FOOD_COST = CFG.CITY.TIER_MANPOWER;
export const CITY_ENERGY_COST = CFG.CITY.TIER_MANPOWER;

// Building constants (derived from CFG.BUILDINGS)
export const BUILDING_TICKS: Record<string, number> = {};
export const BUILDING_COSTS: Record<string, { food: number; material: number; consumesEngineer: boolean }> = {};
export const BUILDING_PLACEMENT_RULES: Record<string, string[]> = {};
export const EXTRACTOR_OUTPUT: Record<string, { resource: ResourceType; amount: number }> = {};
export const EXTRACTOR_TYPES: string[] = [];
export const ENGINEER_CONSUMABLE_TYPES: string[] = CFG.RESOURCES.ENGINEER_CONSUMABLE_TYPES;
for (const [key, val] of Object.entries(CFG.BUILDINGS)) {
  BUILDING_TICKS[key] = val.ticks;
  BUILDING_COSTS[key] = { food: val.cost.food, material: val.cost.material, consumesEngineer: val.cost.consumesEngineer };
  if (val.placement.length > 0) BUILDING_PLACEMENT_RULES[key] = [...val.placement];
  if (val.extractorOutput) EXTRACTOR_OUTPUT[key] = { resource: val.extractorOutput.resource, amount: val.extractorOutput.amount };
  if (val.extractorOutput && !val.cost.consumesEngineer && key !== 'FACTORY' && key !== 'CITY' && key !== 'RUIN_RESTORE') {
    EXTRACTOR_TYPES.push(key);
  }
}

export const CELL_BUILDING_CAPACITY = CFG.CELL_CAPACITY;
export const PENTAGON_BUILDING_CAPACITY = CFG.CELL_CAPACITY.PENTAGON;
export const SUPPLY_CHAIN_MAX_HOPS = CFG.SUPPLY_CHAIN.MAX_HOPS;
export const SUPPLY_CHAIN_DISTANCE_PENALTY = CFG.SUPPLY_CHAIN.DISTANCE_PENALTY;
export const ENERGY_PIPELINE_MAX_HOPS = CFG.SUPPLY_CHAIN.ENERGY_PIPELINE_MAX_HOPS;

// Resource values
export const FOOD_VALUE = CFG.RESOURCES.FOOD_VALUE;
export const MATERIAL_VALUE = CFG.RESOURCES.MATERIAL_VALUE;
export const RAW_RESOURCES = CFG.RESOURCES.RAW;
export const PROCESSED_RESOURCES = CFG.RESOURCES.PROCESSED;

// Factory
export interface FactoryRecipeDef { id: string; name: string; input: { resource: ResourceType; amount: number }[]; output: { resource: ResourceType; amount: number }[]; ticksPerCycle: number; minFactoryTier: number; }
export const FACTORY_RECIPES: FactoryRecipeDef[] = CFG.FACTORY.RECIPES;
export const FACTORY_XP_PER_CYCLE = CFG.FACTORY.XP_PER_CYCLE;
export const FACTORY_TIER_THRESHOLDS = CFG.FACTORY.TIER_THRESHOLDS;
export const FACTORY_BASE_XP = CFG.FACTORY.BASE_XP;
export const ENGINEER_LEVEL_BUILD_RULES = CFG.ENGINEER_LEVEL_BUILD_RULES;

// Day/Night
export const DAY_NIGHT_CYCLE_TICKS = CFG.DAY_NIGHT.CYCLE_TICKS;
export const SUN_INTENSITY = CFG.DAY_NIGHT.SUN_INTENSITY;
export const AMBIENT_DAY_INTENSITY = CFG.DAY_NIGHT.AMBIENT_DAY_INTENSITY;
export const AMBIENT_NIGHT_INTENSITY = CFG.DAY_NIGHT.AMBIENT_NIGHT_INTENSITY;
export const CITY_GLOW_INTENSITY = CFG.DAY_NIGHT.CITY_GLOW_INTENSITY;
export const CITY_GLOW_COLOR = CFG.DAY_NIGHT.CITY_GLOW_COLOR;
export const NIGHT_COLOR_MIX = CFG.DAY_NIGHT.NIGHT_COLOR_MIX;

// Misc
export const STOCKPILE_RAID_FRACTION = CFG.STOCKPILE_RAID_FRACTION;
export const ENERGY_CREDITS_INITIAL = CFG.ENERGY_CREDITS_INITIAL;