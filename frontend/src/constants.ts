import {
  TerrainType,
  FogVisibility,
  type FogConfig,
  type GlobeConfig,
  type CameraConfig,
} from './types/index';
import { CFG, type TerrainConfig } from '@vantaris/shared';

export const TERRAIN_CONFIGS: Record<string, TerrainConfig> = CFG.TERRAIN;
export const GLOBE_CONFIG: GlobeConfig = CFG.GLOBE;
export const FOG_CONFIG: FogConfig = CFG.FOG;
export const CAMERA_CONFIG: CameraConfig = CFG.CAMERA;