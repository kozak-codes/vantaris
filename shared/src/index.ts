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
} from './types';

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
} from './types';

export { buildAdjacencyMap } from './hexAdjacency';

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