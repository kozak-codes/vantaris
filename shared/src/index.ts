export {
  TerrainType,
  FogVisibility,
  GamePhase,
  QueueType,
  UnitType,
  UnitStatus,
  BuildingType,
  CityTier,
  RuinType,
  ResourceType,
  ResourceTier,
  BoundaryType,
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
  UnitData,
  CityData,
  BuildingData,
  PlayerResourceData,
  CityStockpileData,
  FactoryRecipe,
  PlateData,
  ChatMessage,
  MoveOrder,
  AdjacencyMap,
  ResourceYield,
  StockpileEntry,
  ProductionItem,
  ResourceInflowEntry,
  PlayerSummary,
} from './types';

export { buildAdjacencyMap } from './hexAdjacency';

export { CFG, type ICFG, type TerrainConfig, type UnitConfig, type BuildingConfig, type ResourceConfig } from './CFG';

export {
  getPassableTerrain,
  getMovementCost,
  getCellBuildingCapacity,
  getBuildingTicks,
  getBuildingCosts,
  getBuildingPlacementRules,
  getExtractorOutput,
  getExtractorTypes,
  getFoodValue,
  getMaterialValue,
  getRawResources,
  getProcessedResources,
  getResourceCategoryMap,
  getResourceCategories,
  getFactoryRecipes,
  getUnitBuildableTypes,
  getInfantryBuildableTypes,
  getEngineerBuildableTypes,
  getUnitProductionCosts,
} from './cfgHelpers';

export { MATCHMAKING_CFG } from './matchmaking';