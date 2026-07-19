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

export enum OrbitalBodyType {
  STAR = 'STAR',
  PLANET = 'PLANET',
  MOON = 'MOON',
  SPACECRAFT = 'SPACECRAFT',
  STATION = 'STATION',
}

export interface OrbitalElements {
  parent: string;          // id of the body this orbits ('' for the star)
  semiMajorAxis: number;   // km from parent body center
  eccentricity: number;
  inclination: number;     // radians
  longitudeOfAscendingNode: number; // radians (Ω)
  argumentOfPeriapsis: number;      // radians (ω)
  meanAnomalyAtEpoch: number;       // radians (M0)
  period: number;          // seconds for one full orbit
}

export interface OrbitalBodyData {
  bodyId: string;
  name: string;
  type: OrbitalBodyType;
  ownerId: string;          // for spacecraft/stations; '' for natural bodies
  mass: number;             // kg
  radius: number;          // km (physical body radius)
  elements: OrbitalElements;
  fuel: number;             // for spacecraft; 0 otherwise
  fuelCapacity: number;    // for spacecraft; 0 otherwise
  // Current world-space position relative to the star, in km. Server-authoritative,
  // recomputed each tick from the orbital elements. Clients render from this.
  position: [number, number, number];
  // For spacecraft that have landed on a planet, the cellId + sub-hex index they occupy.
  landedCellId: string | null;
  landedSubHex: number; // -1 if not landed or not set
  // Descent state — when a lander is animating from orbit to a chosen surface
  // cell, the server sets these. `descending` is true during the animation;
  // `descentTargetCellId` is the chosen landing cell; `descentTicksRemaining`
  // counts down to 0 at which point the body lands.
  descending: boolean;
  descentTargetCellId: string | null;
  descentTicksRemaining: number;
}

export enum QueueType {
  QUICK = 'QUICK',
}

export enum CityTier {
  SETTLEMENT = 1,
  VILLAGE = 2,
  TOWN = 3,
  CITY = 4,
  METROPOLIS = 5,
  MEGACITY = 6,
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
  energyCredits: number;
  claimCompensation: number;
  foodCreditRate: number;
}

export interface CellSnapshot {
  ownerId: string | null;
}

export interface SpawnPoint {
  cellId: string;
}

export interface HexCell {
  id: number;
  center: [number, number, number];
  vertexIds: number[];
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

export interface SubHexConfig {
  radius: number;
  heightMin: number;
  heightMax: number;
  maxBuildSlope: number;
  heightNoiseScale: number;
  subBiomeNoiseScale: number;
  planetSubdiv: number;
  /** Discrete elevation tiers — height snaps to one of 5 buckets. */
  elevation: {
    /** Tier boundaries (continuous height → tier). */
    seaLevel: number;
    deepWater: number;
    hill: number;
    mountain: number;
    /** Snapped height value assigned to each tier. */
    deepWaterHeight: number;
    shallowWaterHeight: number;
    flatHeight: number;
    hillHeight: number;
    mountainHeight: number;
  };
}

export interface CameraConfig {
  minDistance: number;
  maxDistance: number;
  rotationDamping: number;
  zoomSpeed: number;
  zoomSpeedMin: number;
  zoomSlowDistance: number;
  keyboardRotateSpeed: number;
  tileViewZoom: number;
  tileViewMaxZoom: number;
}

export interface PlayerStateSlice {
  myPlayerId: string;
  currentTick: number;
  sunAngle: number;
  dayNightCycleTicks: number;
  visibleCells: VisibleCellData[];
  revealedCells: RevealedCellData[];
  cities: CityData[];
  players: PlayerSummary[];
  resources: PlayerResourceData;
  orbitalBodies: OrbitalBodyData[];
  constructions: ConstructionData[];
  worldSeed: number;
}

export interface VisibleCellData {
  cellId: string;
  ownerId: string;
  resourceYield: ResourceYield | null;
}

export interface RevealedCellData {
  cellId: string;
  lastKnownOwnerId: string;
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
  homesAvailable: number;
}

export interface PlayerSummary {
  playerId: string;
  displayName: string;
  color: string;
  alive: boolean;
  territoryCount: number;
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

export interface AdjacencyMap {
  [cellId: string]: string[];
}

// ─── Sub-hex (micro tiles within a macro hex) ──

/**
 * A micro hex within a macro hex. Position is in axial coordinates relative
 * to the macro hex center. The macro hex is treated as a hex-of-hexes with
 * the given radius (CFG.SUBHEX.radius).
 */
export interface SubHexData {
  /** Index into the sub-hex array (0 .. count-1). */
  index: number;
  /** Axial q coordinate within the macro hex. */
  q: number;
  /** Axial r coordinate within the macro hex. */
  r: number;
  /** Snapped height displacement along the macro-hex normal (units).
   *  One of 5 discrete values derived from CFG.SUBHEX.elevation. */
  height: number;
  /** Elevation tier — which of the 5 height buckets this sub-hex is in. */
  tier: ElevationTier;
  /** Sub-biome, derived from snapped height + temperature + moisture + noise. */
  subBiome: SubBiomeType;
  /** True if this sub-hex is buildable (not water, slope within limits). */
  buildable: boolean;
}

export enum SubBiomeType {
  WATER = 'WATER',
  BEACH = 'BEACH',
  FLAT = 'FLAT',
  ROLLING = 'ROLLING',
  HILLY = 'HILLY',
  ROCKY = 'ROCKY',
  FOREST_DENSE = 'FOREST_DENSE',
  FOREST_LIGHT = 'FOREST_LIGHT',
  DUNES = 'DUNES',
  CRAGS = 'CRAGS',
  ICE = 'ICE',
  SNOW = 'SNOW',
  TUNDRA = 'TUNDRA',
}

/**
 * Discrete elevation tier — the height field is snapped to one of these 5
 * buckets before biome classification, so the world has only 5 distinct
 * heights. Biomes still vary within a tier via temperature/moisture noise.
 */
export enum ElevationTier {
  DEEP_WATER = 'DEEP_WATER',
  SHALLOW_WATER = 'SHALLOW_WATER',
  FLAT = 'FLAT',
  HILL = 'HILL',
  MOUNTAIN = 'MOUNTAIN',
}

export type ConstructionType = 'HAB' | 'MINE' | 'FARM' | 'FACTORY' | 'ROAD' | 'PORT' | 'SPACEPORT';

export interface ConstructionData {
  id: string;            // `${macroCellId}:${subHexIndex}`
  macroCellId: string;
  subHexIndex: number;
  type: ConstructionType;
  ownerId: string;
}