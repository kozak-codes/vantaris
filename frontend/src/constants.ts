import {
  BiomeType,
  FogVisibility,
  type BiomeConfig,
  type FogConfig,
  type GlobeConfig,
  type CameraConfig,
} from './types/index';
import { CFG } from '@vantaris/shared/constants';

export const BIOME_CONFIGS: BiomeConfig[] = CFG.BIOMES;
export const GLOBE_CONFIG: GlobeConfig = CFG.GLOBE;
export const FOG_CONFIG: FogConfig = CFG.FOG;
export const CAMERA_CONFIG: CameraConfig = CFG.CAMERA;
export const CELL_COLOR_LERP = CFG.CELL_COLOR_LERP;