import {
  BiomeType,
  FogVisibility,
  type BiomeConfig,
  type FogConfig,
  type GlobeConfig,
  type CameraConfig,
} from './types/index';
import { BIOME_CONFIGS as SHARED_BIOME_CONFIGS, GLOBE_CONFIG as SHARED_GLOBE_CONFIG, FOG_CONFIG as SHARED_FOG_CONFIG, CAMERA_CONFIG as SHARED_CAMERA_CONFIG, CELL_COLOR_LERP as SHARED_CELL_COLOR_LERP, CITY_TROOP_PRODUCTION_TICKS, MAX_UNITS_PER_HEX } from '@vantaris/shared/constants';

export const BIOME_CONFIGS: BiomeConfig[] = SHARED_BIOME_CONFIGS;
export const GLOBE_CONFIG: GlobeConfig = SHARED_GLOBE_CONFIG;
export const FOG_CONFIG: FogConfig = SHARED_FOG_CONFIG;
export const CAMERA_CONFIG: CameraConfig = SHARED_CAMERA_CONFIG;
export const CELL_COLOR_LERP = SHARED_CELL_COLOR_LERP;
export { CITY_TROOP_PRODUCTION_TICKS, MAX_UNITS_PER_HEX };