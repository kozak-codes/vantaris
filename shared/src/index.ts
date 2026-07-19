export type {
  RawResourceType,
  ProcessedResourceType,
  CellSnapshot,
  SpawnPoint,
  HexCell,
  HexGrid,
  CellRenderData,
  FogConfig,
  GlobeConfig,
  SubHexConfig,
  CameraConfig,
  PlayerStateSlice,
  VisibleCellData,
  RevealedCellData,
  CityData,
  PlayerResourceData,
  CityStockpileData,
  ChatMessage,
  AdjacencyMap,
  ResourceYield,
  StockpileEntry,
  ProductionItem,
  ResourceInflowEntry,
  PlayerSummary,
  OrbitalBodyData,
  OrbitalElements,
  SubHexData,
  ConstructionData,
} from './types';

export {
  FogVisibility,
  GamePhase,
  QueueType,
  CityTier,
  ResourceType,
  ResourceTier,
  OrbitalBodyType,
  SubBiomeType,
  ElevationTier,
} from './types';

export type { ConstructionType } from './types';

export { buildAdjacencyMap } from './hexAdjacency';

export {
  type AxialCoord,
  hexDistance,
  axialToPixel,
  HEX_DIRECTIONS,
  generateSubHexCoords,
  subHexCount,
  subHexIndexFromAxial,
  axialFromSubHexIndex,
  subHexNeighbors,
  constructionId,
  parseConstructionId,
  subHexSize,
  generateSubHexesWorld,
  sampleWorldTerrain,
  classifyElevation,
  snapHeight,
  type MacroHexContext,
} from './subhex';

export { CFG, type ICFG, type ResourceConfig } from './CFG';

export {
  getFoodValue,
  getMaterialValue,
  getRawResources,
  getProcessedResources,
  getResourceCategoryMap,
  getResourceCategories,
} from './cfgHelpers';

export { MATCHMAKING_CFG } from './matchmaking';