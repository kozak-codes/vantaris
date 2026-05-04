import { GameState } from '../state/GameState';
import { UnitState } from '../state/UnitState';
import { CellState } from '../state/CellState';
import { CFG, getPassableTerrain, getFactoryRecipes, UnitStatus, ResourceType, type AdjacencyMap } from '@vantaris/shared';
import { findPath, buildUnitsByCellId } from '../systems/Pathfinding';
import { assignPath, startClaiming } from '../mutations/units';
import { getBuildingStockpile } from '../mutations/buildings';

const PASSABLE_TERRAIN = getPassableTerrain(CFG);

function needsToReturnHome(unit: UnitState): boolean {
  const vitals = CFG.CITIZEN_VITALS;
  return unit.hunger <= vitals.HUNGER_THRESHOLD
    || unit.rest <= vitals.REST_THRESHOLD
    || unit.health < vitals.HEALTH_THRESHOLD;
}

interface Task {
  type: 'CLAIM' | 'WORK';
  cellId: string;
  ownerId: string;
  reservedBy: string | null;
  value: number;
  taskKey: string;
}

interface TaskQueue {
  tasks: Map<string, Task>;
}

function computeWorkSustainTicks(unit: UnitState, building: any, state: GameState): number {
  const vitals = CFG.CITIZEN_VITALS;
  const hungerTicks = unit.hunger > 0 ? unit.hunger / vitals.HUNGER_DRAIN_PER_TICK : 0;
  const restTicks = unit.rest > 0 ? unit.rest / vitals.REST_DRAIN_PER_TICK : 0;
  const vitalTicks = Math.min(hungerTicks, restTicks);

  let fillTicks = Infinity;
  const bldgConfig = CFG.BUILDINGS[building.type];
  if (bldgConfig && bldgConfig.extractorOutput) {
    const target = building.stockpileTarget || bldgConfig.target;
    if (target > 0) {
      const sp = getBuildingStockpile(building);
      const totalStock = Object.values(sp).reduce((sum: number, v: number) => sum + v, 0);
      const remaining = Math.max(0, target - totalStock);
      if (remaining > 0 && bldgConfig.extractorOutput.amount > 0) {
        fillTicks = remaining / bldgConfig.extractorOutput.amount;
      } else if (remaining <= 0) {
        fillTicks = 0;
      }
    }
  }

  const sustainCycles = Math.min(vitalTicks, fillTicks) / 100;
  return Math.max(1, sustainCycles);
}

function canBuildingProduce(
  building: any,
  state: GameState,
  cellPositions: Record<string, [number, number, number]>,
): boolean {
  const bldgConfig = CFG.BUILDINGS[building.type];
  if (!bldgConfig) return false;

  if (bldgConfig.extractorOutput) {
    if (building.type === 'FARM') {
      const pos = cellPositions[building.cellId];
      if (pos) {
        const len = Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]);
        if (len > 0) {
          const nx = pos[0] / len;
          const nz = pos[2] / len;
          const sunAngle = state.getSunAngle();
          const dot = nx * Math.cos(sunAngle) + nz * Math.sin(sunAngle);
          if (dot < 0) return false;
        }
      }
    }
    return true;
  }

  if (building.type === 'FACTORY' && building.recipe) {
    const recipe = getFactoryRecipes(CFG).find(r => r.id === building.recipe);
    if (!recipe) return false;
    const sp = getBuildingStockpile(building);
    return recipe.input.every((inp: { resource: string; amount: number }) => {
      return (sp[inp.resource] || 0) >= inp.amount;
    });
  }

  return false;
}

function rebuildClaimTasks(
  queue: TaskQueue,
  state: GameState,
  adjacencyMap: AdjacencyMap,
  cellPositions: Record<string, [number, number, number]>,
): void {
  const existingClaimCells = new Set<string>();
  for (const [, task] of queue.tasks) {
    if (task.type === 'CLAIM') existingClaimCells.add(task.cellId);
  }

  const claimed = new Set<string>();
  for (const task of queue.tasks.values()) {
    if (task.type === 'CLAIM' && task.reservedBy) {
      const unit = state.units.get(task.reservedBy);
      if (unit && (unit.status === 'CLAIMING' || unit.status === 'MOVING')) {
        claimed.add(task.cellId);
      } else {
        task.reservedBy = null;
      }
    }
  }

  for (const [cellId, cell] of state.cells) {
    if (cell.ownerId || !PASSABLE_TERRAIN.includes(cell.biome)) {
      if (queue.tasks.has(cellId)) {
        queue.tasks.delete(cellId);
      }
      continue;
    }

    let adjacentToOwner: string | null = null;
    for (const nId of (adjacencyMap[cellId] ?? [])) {
      const nCell = state.cells.get(nId);
      if (nCell && nCell.ownerId) {
        adjacentToOwner = nCell.ownerId;
        break;
      }
    }

    if (!adjacentToOwner) {
      if (queue.tasks.has(cellId)) queue.tasks.delete(cellId);
      continue;
    }

    if (claimed.has(cellId)) continue;

    if (!queue.tasks.has(cellId)) {
      const player = state.players.get(adjacentToOwner);
      const comp = player?.claimCompensation ?? 0;
      if (comp > 0) {
        queue.tasks.set(cellId, {
          type: 'CLAIM',
          cellId,
          ownerId: adjacentToOwner,
          reservedBy: null,
          value: comp,
          taskKey: `claim_${cellId}`,
        });
      }
    } else {
      const task = queue.tasks.get(cellId)!;
      if (task.type === 'CLAIM') {
        if (task.ownerId !== adjacentToOwner) {
          task.ownerId = adjacentToOwner;
          task.reservedBy = null;
        }
        const player = state.players.get(task.ownerId);
        task.value = player?.claimCompensation ?? 0;
      }
    }
  }

  for (const [, building] of state.buildings) {
    if (building.productionTicksRemaining > 0) continue;
    const wage = building.wagePer100Ticks;
    if (wage <= 0) continue;

    if (!canBuildingProduce(building, state, cellPositions)) continue;

    const bldgConfig = CFG.BUILDINGS[building.type];
    const hasExtractor = bldgConfig && bldgConfig.extractorOutput;

    if (hasExtractor) {
      const key = `work_${building.buildingId}`;
      const player = state.players.get(building.ownerId);
      const canPay = player && player.energyCredits >= wage;

      const target = building.stockpileTarget || bldgConfig.target || 0;
      if (target > 0) {
        const sp = getBuildingStockpile(building);
        const totalStock = Object.values(sp).reduce((sum: number, v: number) => sum + v, 0);
        if (totalStock >= target) {
          if (queue.tasks.has(key)) {
            const task = queue.tasks.get(key)!;
            if (task.reservedBy) {
              const unit = state.units.get(task.reservedBy);
              if (unit) unit.status = UnitStatus.IDLE;
            }
            queue.tasks.delete(key);
          }
          continue;
        }
      }

      if (!canPay) {
        if (queue.tasks.has(key)) queue.tasks.delete(key);
        continue;
      }

      if (!queue.tasks.has(key)) {
        queue.tasks.set(key, {
          type: 'WORK',
          cellId: building.cellId,
          ownerId: building.ownerId,
          reservedBy: null,
          value: wage,
          taskKey: key,
        });
      } else {
        const task = queue.tasks.get(key)!;
        task.value = wage;
        task.ownerId = building.ownerId;
        if (!player || player.energyCredits < task.value) {
          task.reservedBy = null;
        }
      }
    } else {
      const target = building.stockpileTarget || 0;
      if (target <= 0) continue;

      const sp = getBuildingStockpile(building);
      const totalStock = Object.values(sp).reduce((sum, v) => sum + v, 0);
      if (totalStock < target) {
        const key = `work_${building.buildingId}`;
        if (queue.tasks.has(key)) queue.tasks.delete(key);
        continue;
      }

      const key = `work_${building.buildingId}`;
      const player = state.players.get(building.ownerId);
      const canPay = player && player.energyCredits >= wage;

      if (!canPay) {
        if (queue.tasks.has(key)) queue.tasks.delete(key);
        continue;
      }

      if (!queue.tasks.has(key)) {
        queue.tasks.set(key, {
          type: 'WORK',
          cellId: building.cellId,
          ownerId: building.ownerId,
          reservedBy: null,
          value: wage,
          taskKey: key,
        });
      } else {
        const task = queue.tasks.get(key)!;
        const currentPlayer = state.players.get(building.ownerId);
        task.value = wage;
        task.ownerId = building.ownerId;
        if (!currentPlayer || currentPlayer.energyCredits < task.value) {
          task.reservedBy = null;
        }
      }
    }
  }
}

function releaseDeadReservations(queue: TaskQueue, state: GameState): void {
  for (const [, task] of queue.tasks) {
    if (!task.reservedBy) continue;
    const unit = state.units.get(task.reservedBy);
    if (!unit || unit.ownerId !== task.ownerId) {
      task.reservedBy = null;
    }
  }
}

function reserveBestTask(
  unit: UnitState,
  queue: TaskQueue,
  state: GameState,
  adjacencyMap: AdjacencyMap,
  cellPositions: Record<string, [number, number, number]>,
  unitsByCellId: Map<string, number>,
): Task | null {
  const player = state.players.get(unit.ownerId);
  if (!player) return null;

  const candidates: { task: Task; travelTicks: number }[] = [];

  for (const [, task] of queue.tasks) {
    if (task.reservedBy) continue;
    if (task.ownerId !== unit.ownerId) continue;
    if (task.value <= 0) continue;
    if (task.type === 'CLAIM' && player.claimCompensation <= 0) continue;

    if ((unitsByCellId.get(task.cellId) ?? 0) >= CFG.MAX_PER_HEX && task.cellId !== unit.cellId) continue;

    if (task.cellId === unit.cellId) {
      candidates.push({ task, travelTicks: 0 });
      continue;
    }

    const path = findPath(unit.cellId, task.cellId, state.cells as any, adjacencyMap, unitsByCellId, CFG.MAX_PER_HEX, cellPositions);
    if (!path) continue;

    let travelTicks = 0;
    for (const cid of path) {
      const c = state.cells.get(cid);
      travelTicks += c ? (CFG.TERRAIN[c.biome]?.cost ?? 10) : 10;
    }
    candidates.push({ task, travelTicks });
  }

  if (candidates.length === 0) return null;

  const unitConfig = CFG.UNITS[unit.type];
  const multiplier = taskTypeMultiplier(unitConfig, candidates[0].task?.type);

  candidates.sort((a, b) => {
    let actionTicksA = travelTicksToAction(a.task.type, multiplier);
    let actionTicksB = travelTicksToAction(b.task.type, multiplier);
    const totalA = a.travelTicks + actionTicksA;
    const totalB = b.travelTicks + actionTicksB;

    let valueA = a.task.value;
    let valueB = b.task.value;

    if (a.task.type === 'WORK') {
      const bldg = [...state.buildings.values()].find(bl => bl.cellId === a.task.cellId && bl.ownerId === a.task.ownerId);
      if (bldg) valueA *= computeWorkSustainTicks(unit, bldg, state);
    }
    if (b.task.type === 'WORK') {
      const bldg = [...state.buildings.values()].find(bl => bl.cellId === b.task.cellId && bl.ownerId === b.task.ownerId);
      if (bldg) valueB *= computeWorkSustainTicks(unit, bldg, state);
    }

    const rateA = totalA > 0 ? valueA / totalA : 0;
    const rateB = totalB > 0 ? valueB / totalB : 0;
    return rateB - rateA;
  });

  const best = candidates[0];
  best.task.reservedBy = unit.unitId;
  return best.task;
}

function taskTypeMultiplier(unitConfig: any, taskType?: string): number {
  if (taskType === 'CLAIM') return unitConfig?.claimTickMultiplier ?? 1;
  return 1;
}

function travelTicksToAction(taskType: string | undefined, multiplier: number): number {
  if (taskType === 'CLAIM') return CFG.CLAIM.TICKS_UNCLAIMED * multiplier;
  return 100; // WORK: wage per 100 ticks
}

export function processCitizenAI(
  state: GameState,
  adjacencyMap: AdjacencyMap,
  cellPositions: Record<string, [number, number, number]>,
  tick: number,
  queue: TaskQueue,
): void {
  rebuildClaimTasks(queue, state, adjacencyMap, cellPositions);
  releaseDeadReservations(queue, state);

  const unitsByCellId = buildUnitsByCellId(state.units);

  for (const [, unit] of state.units) {
    if (unit.ownerId === '') continue;

    if (unit.status === 'RETURNING') continue;

    if (unit.status === 'WORKING') {
      if (needsToReturnHome(unit)) {
        const homeCity = state.cities.get(unit.homeCityId);
        if (homeCity) {
          if (unit.cellId === homeCity.cellId) {
            unit.status = 'RETURNING';
            unit.path = '[]';
            unit.movementTicksRemaining = 0;
            unit.movementTicksTotal = 0;
          } else {
            const path = findPath(unit.cellId, homeCity.cellId, state.cells as any, adjacencyMap, unitsByCellId, CFG.MAX_PER_HEX, cellPositions);
            if (path && path.length > 0) {
              assignPath(state, unit.unitId, path);
              unit.status = 'RETURNING';
            }
          }
        }
        continue;
      }

      if (tick % 100 === 0) {
        const currentTask = [...queue.tasks.values()].find(t => t.reservedBy === unit.unitId);
        const currentTaskValue = currentTask ? currentTask.value : 0;

        queue.tasks.forEach(t => { if (t.reservedBy === unit.unitId) t.reservedBy = null; });

        const bestTask = reserveBestTask(unit, queue, state, adjacencyMap, cellPositions, unitsByCellId);
        if (bestTask && bestTask.value > currentTaskValue * 1.2) {
          unit.status = UnitStatus.IDLE;
        } else {
          if (bestTask && bestTask !== currentTask) {
            bestTask.reservedBy = null;
          }
          if (currentTask) {
            currentTask.reservedBy = unit.unitId;
          }
          unit.status = 'WORKING';
          continue;
        }
      } else {
        continue;
      }
    }

    if (unit.status !== 'IDLE') {
      if (needsToReturnHome(unit)) {
        const homeCity = state.cities.get(unit.homeCityId);
        if (homeCity) {
          if (unit.cellId === homeCity.cellId) {
            unit.status = 'RETURNING';
            unit.path = '[]';
            unit.movementTicksRemaining = 0;
            unit.movementTicksTotal = 0;
          } else {
            const path = findPath(unit.cellId, homeCity.cellId, state.cells as any, adjacencyMap, unitsByCellId, CFG.MAX_PER_HEX, cellPositions);
            if (path && path.length > 0) {
              assignPath(state, unit.unitId, path);
              unit.status = 'RETURNING';
            }
          }
        }
      }
      continue;
    }

    if (needsToReturnHome(unit)) {
      const homeCity = state.cities.get(unit.homeCityId);
      if (!homeCity) continue;

      if (unit.cellId === homeCity.cellId) {
        unit.status = 'RETURNING';
      } else {
        const path = findPath(unit.cellId, homeCity.cellId, state.cells as any, adjacencyMap, unitsByCellId, CFG.MAX_PER_HEX, cellPositions);
        if (path && path.length > 0) {
          assignPath(state, unit.unitId, path);
          unit.status = 'RETURNING';
        }
      }
      continue;
    }

    const currentCell = state.cells.get(unit.cellId);
    const unitConfig = CFG.UNITS[unit.type];

    const reservedTask = unit.unitId ? [...queue.tasks.values()].find(t => t.reservedBy === unit.unitId) : null;
    if (reservedTask && reservedTask.type === 'WORK' && reservedTask.cellId === unit.cellId) {
      const building = [...state.buildings.values()].find(b => b.cellId === reservedTask.cellId && b.ownerId === unit.ownerId);
      if (building) {
        const bldgConfig = CFG.BUILDINGS[building.type];
        const target = building.stockpileTarget || bldgConfig?.target || 0;
        const sp = getBuildingStockpile(building);
        const totalStock = Object.values(sp).reduce((sum: number, v: number) => sum + v, 0);
        const stockFull = target > 0 && totalStock >= target;
        const canProduce = canBuildingProduce(building, state, cellPositions);
        if (stockFull || !canProduce) {
          reservedTask.reservedBy = null;
          unit.status = UnitStatus.IDLE;
        } else {
          unit.status = 'WORKING';
          continue;
        }
      } else {
        unit.status = 'WORKING';
        continue;
      }
    }

    if (unitConfig?.canClaim && currentCell && !currentCell.ownerId && PASSABLE_TERRAIN.includes(currentCell.biome)) {
      let adjacentToOwn = false;
      for (const nId of (adjacencyMap[unit.cellId] ?? [])) {
        const nCell = state.cells.get(nId);
        if (nCell && nCell.ownerId === unit.ownerId) { adjacentToOwn = true; break; }
      }
      if (adjacentToOwn) {
        const task = queue.tasks.get(unit.cellId);
        if (task && !task.reservedBy) {
          task.reservedBy = unit.unitId;
        }
        if (task && task.reservedBy === unit.unitId) {
          startClaiming(state, unit.unitId);
          continue;
        }
      }
    }

    const task = reserveBestTask(unit, queue, state, adjacencyMap, cellPositions, unitsByCellId);
    if (!task) {
      const homeCity = state.cities.get(unit.homeCityId);
      if (homeCity && unit.cellId !== homeCity.cellId) {
        const path = findPath(unit.cellId, homeCity.cellId, state.cells as any, adjacencyMap, unitsByCellId, CFG.MAX_PER_HEX, cellPositions);
        if (path && path.length > 0) {
          assignPath(state, unit.unitId, path);
          unit.status = 'RETURNING';
        }
      }
      continue;
    }

    if (task.cellId === unit.cellId) {
      if (task.type === 'CLAIM') {
        startClaiming(state, unit.unitId);
      } else if (task.type === 'WORK') {
        unit.status = 'WORKING';
      }
    } else {
      const path = findPath(unit.cellId, task.cellId, state.cells as any, adjacencyMap, unitsByCellId, CFG.MAX_PER_HEX, cellPositions);
      if (path && path.length > 0) {
        assignPath(state, unit.unitId, path);
      } else {
        task.reservedBy = null;
      }
    }
  }
}

export function createTaskQueue(): TaskQueue {
  return { tasks: new Map() };
}