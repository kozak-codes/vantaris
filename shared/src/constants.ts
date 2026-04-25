import { BiomeType, type BiomeConfig, type FogConfig, type GlobeConfig, type CameraConfig, TerrainType } from './types';

export const BIOME_CONFIGS: BiomeConfig[] = [
  { type: BiomeType.Ocean, color: '#1a6b9a', weight: 0.35 },
  { type: BiomeType.Plains, color: '#4a7c3f', weight: 0.25 },
  { type: BiomeType.Forest, color: '#2d5a1b', weight: 0.18 },
  { type: BiomeType.Mountain, color: '#7a6a5a', weight: 0.10 },
  { type: BiomeType.Desert, color: '#c4a35a', weight: 0.07 },
  { type: BiomeType.Tundra, color: '#a8c4cc', weight: 0.05 },
];

export const GLOBE_CONFIG: GlobeConfig = {
  radius: 5,
  subdivideLevel: 3,
  borderWidth: 0.3,
};

export const FOG_CONFIG: FogConfig = {
  unexploredColor: '#0a0a0a',
  unexploredOpacity: 0.95,
  exploredSaturation: 0.25,
  exploredBrightness: 0.35,
  revealedCellCount: 7,
  revealAnimationMs: 300,
};

export const CAMERA_CONFIG: CameraConfig = {
  minDistance: 7,
  maxDistance: 25,
  rotationDamping: 0.92,
  zoomSpeed: 1.0,
  keyboardRotateSpeed: 2.5,
};

export const CELL_COLOR_LERP = 0.08;

export const QUEUE_CONFIG: { minPlayers: number; maxPlayers: number; subdivideLevel: number } = {
  minPlayers: 1,
  maxPlayers: 8,
  subdivideLevel: 3,
};

export const TICK_RATE_MS = 100;
export const MATCHMAKING_COUNTDOWN_SECONDS = 5;
export const RECONNECTION_WINDOW = 60;
export const STARTING_TERRITORY_SIZE = 1;
export const VISION_RANGE = 1;
export const TROOP_VISION_RANGE = 1;

export const PASSABLE_TERRAIN: TerrainType[] = [
  TerrainType.PLAINS,
  TerrainType.FOREST,
  TerrainType.MOUNTAIN,
  TerrainType.DESERT,
  TerrainType.TUNDRA,
];

export const IMPASSABLE_TERRAIN: TerrainType[] = [
  TerrainType.OCEAN,
];

export const MOVEMENT_COST: Record<string, number> = {
  PLAINS: 30,
  DESERT: 30,
  FOREST: 60,
  MOUNTAIN: 90,
  TUNDRA: 60,
  OCEAN: Infinity,
};

export const CITY_TROOP_PRODUCTION_TICKS = 100;
export const MAX_UNITS_PER_HEX = 3;

export const CITY_TIER_XP_THRESHOLDS = [0, 5000, 15000, 40000, 100000, 250000];

export const CITY_TIER_MANPOWER: Record<number, number> = {
  1: 2, 2: 6, 3: 15, 4: 35, 5: 90, 6: 250,
};

export const CITY_FOOD_COST: Record<number, number> = {
  1: 1, 2: 3, 3: 8, 4: 20, 5: 55, 6: 150,
};

export const CITY_ENERGY_COST: Record<number, number> = {
  1: 1, 2: 2, 3: 5, 4: 12, 5: 30, 6: 80,
};

export const CLAIM_TICKS_UNCLAIMED = 50;
export const CLAIM_TICKS_ENEMY = 3000;

export const VALID_CITY_SPAWN_TERRAIN = [TerrainType.PLAINS];

export const ENERGY_CREDITS_INITIAL = 0;
export const FACTORY_BASE_XP = 0;