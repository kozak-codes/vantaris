import {
  FogVisibility,
  ResourceType,
  CFG,
  OrbitalBodyType,
  type AdjacencyMap,
  type PlayerStateSlice,
  type VisibleCellData,
  type RevealedCellData,
  type CityData,
  type PlayerSummary,
  type PlayerResourceData,
  type StockpileEntry,
  type ResourceInflowEntry,
  type OrbitalBodyData,
  type ConstructionData,
  type ConstructionType,
} from '@vantaris/shared';
import { GameState } from '../state/GameState';
import { getCityStockpile } from './resources';

const VISION_RANGE = 1;

export function revealCellForPlayer(state: GameState, playerId: string, cellId: string): void {
  const player = state.players.get(playerId);
  if (!player) return;
  player.fog.setVisible(cellId);
}

export function snapshotAndHideCell(state: GameState, playerId: string, cellId: string): void {
  const player = state.players.get(playerId);
  if (!player) return;
  const cell = state.cells.get(cellId);
  if (!cell) return;
  const snapshot = JSON.stringify({
    ownerId: cell.ownerId || null,
  });
  player.fog.setRevealed(cellId, snapshot);
}

export function computeVisibilityForPlayer(
  state: GameState,
  playerId: string,
  adjacencyMap: AdjacencyMap,
  visionRange: number = VISION_RANGE,
  cellPositions?: Record<string, [number, number, number]>,
): void {
  const player = state.players.get(playerId);
  if (!player) return;

  const visibleCellIds = new Set<string>();

  // Reveal tiles under the player's orbiting or landed spacecraft.
  for (const [, body] of state.orbitalBodies) {
    if (body.ownerId !== playerId || body.type !== OrbitalBodyType.SPACECRAFT) continue;
    if (body.landedCellId) {
      visibleCellIds.add(body.landedCellId);
      collectNeighborsInRange(body.landedCellId, visionRange, visibleCellIds, adjacencyMap);
      continue;
    }
    // Orbiting: find the cell directly below the spacecraft's sub-point.
    const cellId = findCellBelowSpacecraft(state, body, cellPositions);
    if (cellId) {
      visibleCellIds.add(cellId);
      collectNeighborsInRange(cellId, visionRange, visibleCellIds, adjacencyMap);
    }
  }

  const currentVisible = new Set<string>();
  for (const [cellId, fogValue] of player.fog.visibility) {
    if (fogValue === FogVisibility.VISIBLE) {
      currentVisible.add(cellId);
    }
  }

  for (const cellId of currentVisible) {
    if (!visibleCellIds.has(cellId)) {
      snapshotAndHideCell(state, playerId, cellId);
    }
  }

  for (const cellId of visibleCellIds) {
    if (!currentVisible.has(cellId)) {
      player.fog.setVisible(cellId);
    }
  }
}
function findCellBelowSpacecraft(
  state: GameState,
  body: any,
  cellPositions?: Record<string, [number, number, number]>,
): string | null {
  const parent = state.orbitalBodies.get(body.elements.parent);
  if (!parent) return null;
  const dx = body.posX - parent.posX;
  const dy = body.posY - parent.posY;
  const dz = body.posZ - parent.posZ;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len === 0) return null;
  const ux = dx / len, uy = dy / len, uz = dz / len;

  let bestId: string | null = null;
  let bestDot = -Infinity;
  for (const [cellId, cell] of state.cells) {
    let pos: [number, number, number] | undefined;
    if (cellPositions) {
      pos = cellPositions[cellId];
    }
    if (!pos) continue;
    const cx = pos[0], cy = pos[1], cz = pos[2];
    const clen = Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (clen === 0) continue;
    const dot = (cx * ux + cy * uy + cz * uz) / clen;
    if (dot > bestDot) {
      bestDot = dot;
      bestId = cellId;
    }
  }

  return bestId;
}

function collectNeighborsInRange(
  startCellId: string,
  range: number,
  result: Set<string>,
  adjacencyMap: AdjacencyMap,
): void {
  const visited = new Set<string>([startCellId]);
  let frontier = new Set<string>([startCellId]);

  for (let i = 0; i < range; i++) {
    const nextFrontier = new Set<string>();
    for (const cellId of frontier) {
      const neighbors = adjacencyMap[cellId] ?? [];
      for (const nId of neighbors) {
        if (!visited.has(nId)) {
          visited.add(nId);
          result.add(nId);
          nextFrontier.add(nId);
        }
      }
    }
    frontier = nextFrontier;
  }
}

function stockpileMapToEntries(stockpile: Record<string, number>): StockpileEntry[] {
  const entries: StockpileEntry[] = [];
  for (const [resource, amount] of Object.entries(stockpile)) {
    if (amount > 0) entries.push({ resource, amount: Math.floor(amount * 100) / 100 });
  }
  return entries;
}

export function buildPlayerSlice(
  state: GameState,
  playerId: string,
): PlayerStateSlice {
  const player = state.players.get(playerId);
  if (!player) {
    return {
      myPlayerId: playerId,
      currentTick: state.tick,
      sunAngle: state.getSunAngle(),
      dayNightCycleTicks: state.dayNightCycleTicks,
      visibleCells: [],
      revealedCells: [],
      cities: [],
      players: [],
      resources: { food: 0, energy: 0, foodPerTick: 0, energyPerTick: 0, totalPopulation: 0, factoryCount: 0, energyCredits: 0, claimCompensation: 0, foodCreditRate: 1 },
      orbitalBodies: [],
      constructions: [],
      worldSeed: 0,
    };
  }

  const visibleCells: VisibleCellData[] = [];
  const revealedCells: RevealedCellData[] = [];
  const visibleCellIds = new Set<string>();
  const revealedCellIds = new Set<string>();

  for (const [cellId, fogValue] of player.fog.visibility) {
    if (fogValue === FogVisibility.VISIBLE) {
      const cell = state.cells.get(cellId);
      if (cell) {
        visibleCells.push({
          cellId: cell.cellId,
          ownerId: cell.ownerId,
          resourceYield: null,
        });
        visibleCellIds.add(cellId);
      }
    } else if (fogValue === FogVisibility.REVEALED) {
      const snapshot = player.fog.getSnapshot(cellId);
      if (snapshot) {
        const data = JSON.parse(snapshot);
        revealedCells.push({
          cellId,
          lastKnownOwnerId: data.ownerId || '',
        });
        revealedCellIds.add(cellId);
      }
    }
  }

  const cities: CityData[] = [];
  for (const [, city] of state.cities) {
    if (visibleCellIds.has(city.cellId)) {
      const nextThreshold = city.tier < CFG.CITY.TIER_XP_THRESHOLDS.length
        ? CFG.CITY.TIER_XP_THRESHOLDS[city.tier]
        : CFG.CITY.TIER_XP_THRESHOLDS[CFG.CITY.TIER_XP_THRESHOLDS.length - 1];
      const citySp = getCityStockpile(city);
      let resourceInflows: ResourceInflowEntry[] = [];
      try { resourceInflows = JSON.parse(city.resourceInflows); } catch {}
      cities.push({
        cityId: city.cityId,
        ownerId: city.ownerId,
        cellId: city.cellId,
        name: city.name,
        tier: city.tier,
        xp: city.xp,
        xpToNext: nextThreshold,
        population: Math.floor(city.population),
        repeatQueue: [],
        priorityQueue: [],
        currentProduction: null,
        productionTicksRemaining: 0,
        productionTicksTotal: 0,
        productionResourcesInvested: {},
        foodPerTick: city.foodPerTick,
        energyPerTick: city.energyPerTick,
        stockpile: stockpileMapToEntries(citySp),
        resourceInflows: resourceInflows,
        homesAvailable: city.homesAvailable,
      });
    }
  }

  const players: PlayerSummary[] = [];
  for (const [pid, ps] of state.players) {
    let cityCount = 0;
    let totalPop = 0;
    for (const [, city] of state.cities) {
      if (city.ownerId === pid) {
        cityCount++;
        totalPop += Math.floor(city.population);
      }
    }
    players.push({
      playerId: ps.playerId,
      displayName: ps.displayName,
      color: ps.color,
      alive: ps.alive,
      territoryCount: ps.territoryCellCount,
      cityCount,
      population: totalPop,
      factoryCount: 0,
    });
  }

  let totalFood = 0;
  let totalEnergy = 0;
  let totalPop = 0;

  for (const [, city] of state.cities) {
    if (city.ownerId !== playerId) continue;
    totalPop += Math.floor(city.population);
    const sp = getCityStockpile(city);
    totalFood += (sp[ResourceType.BREAD] || 0) + (sp[ResourceType.GRAIN] || 0);
    totalEnergy += sp[ResourceType.POWER] || 0;
  }

  const resources: PlayerResourceData = {
    food: Math.floor(totalFood),
    energy: Math.floor(totalEnergy),
    foodPerTick: 0,
    energyPerTick: 0,
    totalPopulation: totalPop,
    factoryCount: 0,
    energyCredits: player.energyCredits,
    claimCompensation: player.claimCompensation,
    foodCreditRate: player.foodCreditRate,
  };

  const orbitalBodies: OrbitalBodyData[] = [];
  for (const [, b] of state.orbitalBodies) {
    orbitalBodies.push({
      bodyId: b.bodyId,
      name: b.name,
      type: b.type as OrbitalBodyType,
      ownerId: b.ownerId,
      mass: b.mass,
      radius: b.radius,
      elements: {
        parent: b.elements.parent,
        semiMajorAxis: b.elements.semiMajorAxis,
        eccentricity: b.elements.eccentricity,
        inclination: b.elements.inclination,
        longitudeOfAscendingNode: b.elements.longitudeOfAscendingNode,
        argumentOfPeriapsis: b.elements.argumentOfPeriapsis,
        meanAnomalyAtEpoch: b.elements.meanAnomalyAtEpoch,
        period: b.elements.period,
      },
      fuel: b.fuel,
      fuelCapacity: b.fuelCapacity,
      position: [b.posX, b.posY, b.posZ],
      landedCellId: b.landedCellId || null,
    });
  }

  // Constructions: only send those on visible macro hexes.
  const constructions: ConstructionData[] = [];
  for (const [, c] of state.constructions) {
    if (visibleCellIds.has(c.macroCellId)) {
      constructions.push({
        id: c.id,
        macroCellId: c.macroCellId,
        subHexIndex: c.subHexIndex,
        type: c.type as ConstructionType,
        ownerId: c.ownerId,
      });
    }
  }

  return {
    myPlayerId: playerId,
    currentTick: state.tick,
    sunAngle: state.getSunAngle(),
    dayNightCycleTicks: state.dayNightCycleTicks,
    visibleCells,
    revealedCells,
    cities,
    players,
    resources,
    orbitalBodies,
    constructions,
    worldSeed: state.worldSeed,
  };
}