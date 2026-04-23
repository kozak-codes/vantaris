export enum BiomeType {
  Ocean = 'OCEAN',
  Plains = 'PLAINS',
  Forest = 'FOREST',
  Mountain = 'MOUNTAIN',
  Desert = 'DESERT',
  Tundra = 'TUNDRA',
}

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
}

export enum UnitStatus {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  CLAIMING = 'CLAIMING',
}

export enum BuildingType {
  CITY = 'CITY',
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

export interface CellSnapshot {
  ownerId: string | null;
  biome: BiomeType;
}

export interface SpawnPoint {
  cellId: string;
}

export interface HexCell {
  id: number;
  center: [number, number, number];
  vertexIds: number[];
  biome: BiomeType;
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
  biome: BiomeType;
  fog: FogVisibility;
  isPentagon: boolean;
}

export interface BiomeConfig {
  type: BiomeType;
  color: string;
  weight: number;
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
  visibleCells: VisibleCellData[];
  revealedCells: RevealedCellData[];
  units: UnitData[];
  cities: CityData[];
  players: PlayerSummary[];
}

export interface VisibleCellData {
  cellId: string;
  biome: string;
  ownerId: string;
}

export interface RevealedCellData {
  cellId: string;
  lastKnownBiome: string;
  lastKnownOwnerId: string;
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
}

export interface CityData {
  cityId: string;
  ownerId: string;
  cellId: string;
  tier: number;
  xp: number;
  population: number;
  producingUnit: boolean;
  productionTicksRemaining: number;
}

export interface PlayerSummary {
  playerId: string;
  displayName: string;
  color: string;
}

export interface MoveOrder {
  unitId: string;
  targetCellId: string;
}

export interface AdjacencyMap {
  [cellId: string]: string[];
}