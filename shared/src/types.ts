export enum FogVisibility {
  VISIBLE = 'VISIBLE',
  REVEALED = 'REVEALED',
  UNREVEALED = 'UNREVEALED',
}

export enum GamePhase {
  WAITING = 'WAITING',
  COUNTDOWN = 'COUNTDOWN',
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
}

export enum QueueType {
  QUICK = 'QUICK',
}

export enum UnitType {
  INFANTRY = 'INFANTRY',
  ENGINEER = 'ENGINEER',
}

export enum UnitStatus {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  CLAIMING = 'CLAIMING',
  BUILDING = 'BUILDING',
}

export enum BuildingType {
  CITY = 'CITY',
  FARM = 'FARM',
  MINE = 'MINE',
  OIL_WELL = 'OIL_WELL',
  LUMBER_CAMP = 'LUMBER_CAMP',
  FACTORY = 'FACTORY',
}

export enum CityTier {
  SETTLEMENT = 1,
  VILLAGE = 2,
  TOWN = 3,
  CITY = 4,
  METROPOLIS = 5,
  MEGACITY = 6,
}

export enum TerrainType {
  OCEAN = 'OCEAN',
  PLAINS = 'PLAINS',
  FOREST = 'FOREST',
  MOUNTAIN = 'MOUNTAIN',
  DESERT = 'DESERT',
  TUNDRA = 'TUNDRA',
}

export enum RuinType {
  RUINED_CITY = 'RUINED_CITY',
  RUINED_FACTORY = 'RUINED_FACTORY',
  RUINED_PORT = 'RUINED_PORT',
  RUINED_BARRACKS = 'RUINED_BARRACKS',
  COLLAPSED_MINE = 'COLLAPSED_MINE',
  OVERGROWN_FARM = 'OVERGROWN_FARM',
}

export enum ResourceType {
  GRAIN = 'GRAIN',
  ORE = 'ORE',
  OIL = 'OIL',
  TIMBER = 'TIMBER',
  BREAD = 'BREAD',
  STEEL = 'STEEL',
  POWER = 'POWER',
  LUMBER = 'LUMBER',
  NONE = 'NONE',
}

export enum ResourceTier {
  RAW = 0,
  PROCESSED = 1,
}

export type RawResourceType = ResourceType.GRAIN | ResourceType.ORE | ResourceType.OIL | ResourceType.TIMBER;
export type ProcessedResourceType = ResourceType.BREAD | ResourceType.STEEL | ResourceType.POWER | ResourceType.LUMBER;

export interface ResourceYield {
  primary: ResourceType;
  amount: number;
}

export interface StockpileEntry {
  resource: string;
  amount: number;
}

export interface ResourceInflowEntry {
  resource: string;
  amount: number;
  source: string;
}

export interface BuildingData {
  buildingId: string;
  ownerId: string;
  cellId: string;
  type: string;
  productionTicksRemaining: number;
  recipe: string;
  factoryTier: number;
  factoryXp: number;
  stockpile: StockpileEntry[];
  resourcesInvested: { food: number; material: number };
}

export interface CityStockpileData {
  resources: StockpileEntry[];
}

export interface PlayerResourceData {
  food: number;
  energy: number;
  foodPerTick: number;
  energyPerTick: number;
  totalPopulation: number;
  factoryCount: number;
}

export interface FactoryRecipe {
  id: string;
  name: string;
  input: { resource: ResourceType; amount: number }[];
  output: { resource: ResourceType; amount: number }[];
  ticksPerCycle: number;
  minFactoryTier: number;
}

export interface PlateData {
  plateId: string;
  type: 'oceanic' | 'continental';
  driftX: number;
  driftY: number;
  driftZ: number;
  seedCellId: string;
}

export enum BoundaryType {
  CONVERGENT_CC = 'CONVERGENT_CC',
  CONVERGENT_CO = 'CONVERGENT_CO',
  CONVERGENT_OO = 'CONVERGENT_OO',
  DIVERGENT_C = 'DIVERGENT_C',
  DIVERGENT_O = 'DIVERGENT_O',
  TRANSFORM = 'TRANSFORM',
  NONE = 'NONE',
}

export interface CellSnapshot {
  ownerId: string | null;
  biome: TerrainType;
  ruin: RuinType | null;
}

export interface SpawnPoint {
  cellId: string;
}

export interface HexCell {
  id: number;
  center: [number, number, number];
  vertexIds: number[];
  biome: TerrainType;
  fog: FogVisibility;
  isPentagon: boolean;
}

export interface HexGrid {
  cells: HexCell[];
  vertices: [number, number, number][];
  adjacency: Map<number, number[]>;
}

export interface CellRenderData {
  id: number;
  biome: string;
  fog: FogVisibility;
  isPentagon: boolean;
}

export interface FogConfig {
  unexploredColor: string;
  unexploredOpacity: number;
  exploredSaturation: number;
  exploredBrightness: number;
  revealedCellCount: number;
  revealAnimationMs: number;
}

export interface GlobeConfig {
  radius: number;
  subdivideLevel: number;
  borderWidth: number;
}

export interface CameraConfig {
  minDistance: number;
  maxDistance: number;
  rotationDamping: number;
  zoomSpeed: number;
  keyboardRotateSpeed: number;
}

export interface PlayerStateSlice {
  myPlayerId: string;
  currentTick: number;
  sunAngle: number;
  dayNightCycleTicks: number;
  visibleCells: VisibleCellData[];
  revealedCells: RevealedCellData[];
  ruinMarkers: RuinMarkerData[];
  units: UnitData[];
  cities: CityData[];
  buildings: BuildingData[];
  players: PlayerSummary[];
  resources: PlayerResourceData;
}

export interface VisibleCellData {
  cellId: string;
  biome: string;
  ownerId: string;
  elevation: number;
  moisture: number;
  temperature: number;
  resourceYield: ResourceYield | null;
  ruin: RuinType | null;
  ruinRevealed: boolean;
  buildings: BuildingData[];
  buildingCapacity: number;
}

export interface RevealedCellData {
  cellId: string;
  lastKnownBiome: string;
  lastKnownOwnerId: string;
  lastKnownRuin: RuinType | null;
}

export interface RuinMarkerData {
  cellId: string;
  ruin: RuinType;
}

export interface UnitData {
  unitId: string;
  ownerId: string;
  type: string;
  status: string;
  cellId: string;
  path: string[];
  movementTicksRemaining: number;
  movementTicksTotal: number;
  claimTicksRemaining: number;
  buildTicksRemaining: number;
  engineerLevel: number;
  buildExhaustion: number;
}

export interface ProductionItem {
  type: string;
  ticksCost: number;
  resourceCost: Record<string, number>;
  popCost: number;
}

export interface CityData {
  cityId: string;
  ownerId: string;
  cellId: string;
  name: string;
  tier: number;
  xp: number;
  xpToNext: number;
  population: number;
  repeatQueue: string[];
  priorityQueue: ProductionItem[];
  currentProduction: ProductionItem | null;
  productionTicksRemaining: number;
  productionTicksTotal: number;
  productionResourcesInvested: Record<string, number>;
  foodPerTick: number;
  energyPerTick: number;
  stockpile: StockpileEntry[];
  resourceInflows: ResourceInflowEntry[];
}

export interface PlayerSummary {
  playerId: string;
  displayName: string;
  color: string;
  alive: boolean;
  territoryCount: number;
  unitCount: number;
  cityCount: number;
  population: number;
  factoryCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  targetId: string | null;
}

export interface MoveOrder {
  unitId: string;
  targetCellId: string;
}

export interface AdjacencyMap {
  [cellId: string]: string[];
}