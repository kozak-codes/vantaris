import { BiomeType, type BiomeConfig, type FogConfig, type GlobeConfig, type CameraConfig } from './types';

export const BIOME_CONFIGS: BiomeConfig[] = [
  { type: BiomeType.Ocean, color: '#1a6b9a', weight: 0.60 },
  { type: BiomeType.Plains, color: '#4a7c3f', weight: 0.15 },
  { type: BiomeType.Forest, color: '#2d5a1b', weight: 0.10 },
  { type: BiomeType.Mountain, color: '#7a6a5a', weight: 0.08 },
  { type: BiomeType.Desert, color: '#c4a35a', weight: 0.05 },
  { type: BiomeType.Tundra, color: '#a8c4cc', weight: 0.02 },
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

export const TICK_INTERVAL_MS = 60000;
export const RECONNECTION_WINDOW = 60;
export const STARTING_TERRITORY_SIZE = 7;
export const VISION_RANGE = 1;