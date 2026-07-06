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
  RuinMarkerData,
  CityData,
  PlayerResourceData,
  CityStockpileData,
  PlateData,
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
  TerrainType,
  FogVisibility,
  GamePhase,
  QueueType,
  CityTier,
  RuinType,
  ResourceType,
  ResourceTier,
  BoundaryType,
  OrbitalBodyType,
  SubBiomeType,
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
  type MacroHexContext,
} from './subhex';

export { CFG, type ICFG, type TerrainConfig, type ResourceConfig } from './CFG';

export {
  getPassableTerrain,
  getMovementCost,
  getCellBuildingCapacity,
  getBuildingPlacementRules,
  getExtractorTypes,
  getFoodValue,
  getMaterialValue,
  getRawResources,
  getProcessedResources,
  getResourceCategoryMap,
  getResourceCategories,
} from './cfgHelpers';

export { MATCHMAKING_CFG } from './matchmaking';