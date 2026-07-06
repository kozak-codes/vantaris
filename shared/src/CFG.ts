import {
  TerrainType,
  ResourceType,
  type FogConfig,
  type GlobeConfig,
  type SubHexConfig,
  type CameraConfig,
} from "./types";

// ──────────────────────────────────────────────
// This file contains ONLY the CFG object and its
// interfaces — all gameplay-tunable values in one
// place.  No derived data, no side effects.
// ──────────────────────────────────────────────

export interface TerrainConfig {
  color: string;
  weight: number;
  passable: boolean;
  cost: number;
  capacity: number;
}

export interface ResourceConfig {
  tier: "raw" | "processed";
  foodValue?: number;
  materialValue?: number;
  category?: string;
  recipe?: {
    id?: string;
    name?: string;
    building: string;
    input: { resource: ResourceType; amount: number }[];
    output: { resource: ResourceType; amount: number }[];
    ticksPerCycle: number;
    minFactoryTier: number;
  };
}

export interface ICFG {
  TERRAIN: Record<string, TerrainConfig>;
  GLOBE: GlobeConfig;
  SUBHEX: SubHexConfig;
  FOG: FogConfig;
  CAMERA: CameraConfig;
  TICK_RATE_MS: number;
  RESOURCES: Record<string, ResourceConfig>;
  CITY: {
    INITIAL_STOCKPILE: Record<string, number>;
    POPULATION_INITIAL: number;
    POPULATION_CAP: Record<number, number>;
    POPULATION_GROWTH_RATE: number;
    POPULATION_DECLINE_THRESHOLD: number;
    POPULATION_DECLINE_RATE: number;
    POPULATION_STARVATION_THRESHOLD: number;
    POPULATION_STARVATION_RATE: number;
    BASE_GRAIN_RATE: number;
    BASE_POWER_RATE: number;
    FOOD_DRAIN_PER_POP: number;
    ENERGY_DRAIN_PER_POP: number;
    POWER_DRAIN_BASE: number;
    BREAD_EMERGENCY_GRAIN_RATIO: number;
    INFLOW_WINDOW_TICKS: number;
    TIER_XP_THRESHOLDS: number[];
    XP_PER_POP_PER_10: number;
    XP_FOOD_MULTIPLIER: number;
    XP_ENERGY_MULTIPLIER: number;
    VALID_SPAWN_TERRAIN: TerrainType[];
    HOMES_PER_CITY: number;
  };
  SUPPLY_CHAIN: {
    MAX_HOPS: number;
    DISTANCE_PENALTY: number;
    ENERGY_PIPELINE_MAX_HOPS: number;
  };
  RESOURCE_CATEGORY_LABELS: Record<string, string>;
  DAY_NIGHT: {
    CYCLE_TICKS: number;
    SUN_INTENSITY: number;
    AMBIENT_DAY_INTENSITY: number;
    AMBIENT_NIGHT_INTENSITY: number;
    CITY_GLOW_INTENSITY: number;
    CITY_GLOW_COLOR: string;
    NIGHT_COLOR_MIX: number;
    MOON_INTENSITY: number;
    MOON_ORBIT_TILT: number;
    MOON_ORBIT_RADIUS: number;
    SUN_RENDER_DISTANCE: number;
  };
  SYSTEM: {
    // Render scale for the system view: 1 Three.js unit = this many km.
    VIEW_SCALE_KM: number;
    // Globe radius in km (used to convert orbital km to globe units in planet view).
    PLANET_RADIUS_KM: number;
  };
  ORBITAL: {
    STAR_MASS: number;
    STAR_RADIUS: number;
    PLANET_MASS: number;
    PLANET_RADIUS_KM: number;
    PLANET_SEMI_MAJOR_AXIS_KM: number;
    PLANET_PERIOD_S: number;
    PLANET_ECCENTRICITY: number;
    MOON_MASS: number;
    MOON_RADIUS_KM: number;
    MOON_SEMI_MAJOR_AXIS_KM: number;
    MOON_PERIOD_S: number;
    MOON_ECCENTRICITY: number;
    MOON_INCLINATION: number;
    LANDER_MASS: number;
    LANDER_RADIUS_KM: number;
    LANDER_FUEL_CAPACITY: number;
    LANDER_SEMI_MAJOR_AXIS_KM: number;
    LANDER_PERIOD_S: number;
    LANDER_INCLINATION: number;
  };
  STOCKPILE_RAID_FRACTION: number;
  ENERGY_CREDITS_INITIAL: number;
  PLAYER_COLORS: string[];
  RUIN_TYPE_TO_BUILDING: Record<string, string>;
}

// ──────────────────────────────────────────────
// CFG — Single configuration dictionary
// ──────────────────────────────────────────────

export const CFG: ICFG = {
  // ─── Terrain (merged biome + terrain config) ──
  TERRAIN: {
    OCEAN: {
      color: "#2299cc",
      weight: 0.35,
      passable: false,
      cost: Infinity,
      capacity: 0,
    },
    PLAINS: {
      color: "#6aad4f",
      weight: 0.25,
      passable: true,
      cost: 30,
      capacity: 6,
    },
    FOREST: {
      color: "#3d7a2a",
      weight: 0.18,
      passable: true,
      cost: 60,
      capacity: 5,
    },
    MOUNTAIN: {
      color: "#998877",
      weight: 0.1,
      passable: true,
      cost: 90,
      capacity: 3,
    },
    DESERT: {
      color: "#ddbb6a",
      weight: 0.07,
      passable: true,
      cost: 30,
      capacity: 4,
    },
    TUNDRA: {
      color: "#bbdde6",
      weight: 0.05,
      passable: true,
      cost: 60,
      capacity: 4,
    },
    PENTAGON: {
      color: "#557788",
      weight: 0,
      passable: true,
      cost: 30,
      capacity: 5,
    },
  } as Record<string, TerrainConfig>,

  GLOBE: {
    radius: 5,
    subdivideLevel: 3,
    borderWidth: 0.3,
  },

  // ─── Sub-hex (micro tiles within a macro hex) ──
  SUBHEX: {
    // Hex-of-hexes layout radius. R=8 → 1+3*R*(R+1) = 217 sub-hexes per macro hex.
    radius: 8,
    // Height displacement range (units along macro-hex normal direction).
    heightMin: -0.08,
    heightMax: 0.8,
    // Slope (height delta between adjacent sub-hexes) above which building is disallowed.
    maxBuildSlope: 0.04,
    // Noise frequencies for terrain detail.
    heightNoiseScale: 1.8,
    subBiomeNoiseScale: 1.2,
    // Mesh subdivision per triangle.
    planetSubdiv: 32,
  },

  FOG: {
    unexploredColor: "#0a0a0a",
    unexploredOpacity: 0.95,
    exploredSaturation: 0.25,
    exploredBrightness: 0.35,
    revealedCellCount: 7,
    revealAnimationMs: 300,
  },

  CAMERA: {
    minDistance: 6.1,
    maxDistance: 25,
    rotationDamping: 0.92,
    zoomSpeed: 1.0,
    zoomSpeedMin: 0.15,
    zoomSlowDistance: 7.0,
    keyboardRotateSpeed: 2.5,
    tileViewZoom: 7.5,
    tileViewMaxZoom: 10.0,
  },

  TICK_RATE_MS: 100,

  // ─── Resources (flat dictionary per resource type) ──
  RESOURCES: {
    GRAIN: { tier: "raw", foodValue: 0.67, category: "FOOD" },
    ORE: { tier: "raw", materialValue: 1.0, category: "INDUSTRY" },
    OIL: { tier: "raw", foodValue: 0.5, category: "ENERGY" },
    TIMBER: { tier: "raw", category: "INDUSTRY" },
    BREAD: {
      tier: "processed",
      foodValue: 1.0,
      category: "FOOD",
      recipe: {
        id: "bake",
        name: "Bake Grain",
        building: "FACTORY",
        input: [{ resource: ResourceType.GRAIN, amount: 3 }],
        output: [{ resource: ResourceType.BREAD, amount: 2 }],
        ticksPerCycle: 120,
        minFactoryTier: 1,
      },
    },
    STEEL: {
      tier: "processed",
      materialValue: 1.5,
      category: "INDUSTRY",
      recipe: {
        id: "smelt",
        name: "Smelt Ore",
        building: "FACTORY",
        input: [{ resource: ResourceType.ORE, amount: 5 }],
        output: [{ resource: ResourceType.STEEL, amount: 2 }],
        ticksPerCycle: 140,
        minFactoryTier: 1,
      },
    },
    POWER: {
      tier: "processed",
      category: "ENERGY",
      recipe: {
        id: "refine",
        name: "Refine Oil",
        building: "FACTORY",
        input: [{ resource: ResourceType.OIL, amount: 2 }],
        output: [{ resource: ResourceType.POWER, amount: 2 }],
        ticksPerCycle: 160,
        minFactoryTier: 1,
      },
    },
    LUMBER: {
      tier: "processed",
      category: "INDUSTRY",
      recipe: {
        id: "mill",
        name: "Mill Timber",
        building: "FACTORY",
        input: [{ resource: ResourceType.TIMBER, amount: 3 }],
        output: [{ resource: ResourceType.LUMBER, amount: 2 }],
        ticksPerCycle: 100,
        minFactoryTier: 1,
      },
    },
  } as Record<string, ResourceConfig>,

  // ─── City / Settlement ────────────────────
  CITY: {
    INITIAL_STOCKPILE: {
      [ResourceType.BREAD]: 100,
    } as Record<string, number>,
    POPULATION_INITIAL: 10,
    POPULATION_CAP: {
      1: 50,
      2: 150,
      3: 400,
      4: 1000,
      5: 3000,
      6: 10000,
    } as Record<number, number>,
    POPULATION_GROWTH_RATE: 0.005,
    POPULATION_DECLINE_THRESHOLD: 0.5,
    POPULATION_DECLINE_RATE: 0.001,
    POPULATION_STARVATION_THRESHOLD: 0,
    POPULATION_STARVATION_RATE: 0.01,
    BASE_GRAIN_RATE: 2.0,
    BASE_POWER_RATE: 0.5,
    FOOD_DRAIN_PER_POP: 0.08,
    ENERGY_DRAIN_PER_POP: 0.03,
    POWER_DRAIN_BASE: 0.3,
    BREAD_EMERGENCY_GRAIN_RATIO: 1.5,
    INFLOW_WINDOW_TICKS: 100,
    TIER_XP_THRESHOLDS: [0, 5000, 15000, 40000, 100000, 250000],
    XP_PER_POP_PER_10: 1,
    XP_FOOD_MULTIPLIER: 1.5,
    XP_ENERGY_MULTIPLIER: 1.3,
    VALID_SPAWN_TERRAIN: [TerrainType.PLAINS] as TerrainType[],
    HOMES_PER_CITY: 6,
  },

  // ─── Resource Category Labels ──────────────
  RESOURCE_CATEGORY_LABELS: {
    FOOD: "Food",
    INDUSTRY: "Industry",
    ENERGY: "Energy",
  },

  // ─── Supply Chain ─────────────────────────
  SUPPLY_CHAIN: {
    MAX_HOPS: 6,
    DISTANCE_PENALTY: 0.15,
    ENERGY_PIPELINE_MAX_HOPS: 20,
  },

  // ─── Day / Night ─────────────────────────
  DAY_NIGHT: {
    CYCLE_TICKS: 1800,
    SUN_INTENSITY: 1.5,
    AMBIENT_DAY_INTENSITY: 1.2,
    AMBIENT_NIGHT_INTENSITY: 0.25,
    CITY_GLOW_INTENSITY: 0.4,
    CITY_GLOW_COLOR: "#ffcc44",
    NIGHT_COLOR_MIX: 0.25,
    MOON_INTENSITY: 0.3,
    MOON_ORBIT_TILT: 0.35,
    MOON_ORBIT_RADIUS: 3.5,
    SUN_RENDER_DISTANCE: 40,
  },

  // ─── System view rendering ───────────────
  SYSTEM: {
    VIEW_SCALE_KM: 1e6,
    PLANET_RADIUS_KM: 6371,
  },

  // ─── Orbital body starting parameters ───
  ORBITAL: {
    STAR_MASS: 1.989e30,
    STAR_RADIUS: 696340,
    PLANET_MASS: 5.972e24,
    PLANET_RADIUS_KM: 6371,
    PLANET_SEMI_MAJOR_AXIS_KM: 1.496e8,
    PLANET_PERIOD_S: 365.25 * 24 * 3600 / 10,
    PLANET_ECCENTRICITY: 0.017,
    MOON_MASS: 7.342e22,
    MOON_RADIUS_KM: 1737,
    MOON_SEMI_MAJOR_AXIS_KM: 384400,
    MOON_PERIOD_S: 27.3 * 24 * 3600 / 10,
    MOON_ECCENTRICITY: 0.0549,
    MOON_INCLINATION: 0.089,
    LANDER_MASS: 50000,
    LANDER_RADIUS_KM: 0.05,
    LANDER_FUEL_CAPACITY: 1000,
    LANDER_SEMI_MAJOR_AXIS_KM: 7800,
    LANDER_PERIOD_S: 5400 / 10,
    LANDER_INCLINATION: 0.26,
  },

  // ─── Misc ─────────────────────────────────
  STOCKPILE_RAID_FRACTION: 0.5,
  ENERGY_CREDITS_INITIAL: 50,
  PLAYER_COLORS: [
    "#4488ff",
    "#ff4444",
    "#44cc44",
    "#ffaa00",
    "#cc44cc",
    "#44cccc",
    "#ff8844",
    "#8844ff",
  ],
  RUIN_TYPE_TO_BUILDING: {
    RUINED_FACTORY: "FACTORY",
    COLLAPSED_MINE: "MINE",
    OVERGROWN_FARM: "FARM",
    RUINED_BARRACKS: "FARM",
    RUINED_PORT: "FACTORY",
    RUINED_CITY: "CITY",
  },
};