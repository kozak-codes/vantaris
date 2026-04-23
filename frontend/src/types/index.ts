export enum BiomeType {
  Ocean = 'Ocean',
  Plains = 'Plains',
  Forest = 'Forest',
  Mountain = 'Mountain',
  Desert = 'Desert',
  Tundra = 'Tundra',
}

export enum FogState {
  Unexplored = 'Unexplored',
  Explored = 'Explored',
  Visible = 'Visible',
}

export interface HexCell {
  id: number;
  center: [number, number, number];
  vertexIds: number[];
  biome: BiomeType;
  fog: FogState;
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
  fog: FogState;
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
}