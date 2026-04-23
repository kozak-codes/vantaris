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
  STANDARD = 'STANDARD',
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
  visibleCells: CellStateSlice[];
  revealedCells: CellSnapshot[];
  players: PlayerSlice[];
}

export interface CellStateSlice {
  cellId: string;
  biome: BiomeType;
  ownerId: string;
}

export interface PlayerSlice {
  playerId: string;
  displayName: string;
  color: string;
  territoryCellCount: number;
}