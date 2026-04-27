import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState';
import { CellState } from '../state/CellState';
import { PlayerState } from '../state/PlayerState';
import { CityState } from '../state/CityState';
import { BuildingState } from '../state/BuildingState';
import { TerrainType, ResourceType } from '@vantaris/shared';
import { createBuilding, canPlaceBuilding, tickBuildingProduction, countBuildingsOnCell, getCellBuildingCapacity, getAvailableBuildTypes, getBuildingStockpile, addToBuildingStockpile, getBuildingStockpileAmount, canAffordBuildingCost, tickBuildingConstruction, getResourcesInvested } from '../mutations/buildings';
import { tickExtractorOutput, tickFactoryProcessing, tickCityResourceDrain, tickPopulation, tickCityXP, getCityStockpile, setCityStockpile, addToCityStockpile, getCityStockpileAmount, initCityStockpile, consumeFromCityStockpile } from '../mutations/resources';

function makeTestState(): GameState {
  const state = new GameState();

  const p1 = new PlayerState();
  p1.playerId = 'p1';
  state.players.set('p1', p1);

  const c0 = new CellState();
  c0.cellId = 'cell_0';
  c0.biome = TerrainType.PLAINS;
  c0.ownerId = 'p1';
  c0.elevation = 0.3;
  c0.resourceType = ResourceType.GRAIN;
  c0.resourceAmount = 2;
  c0.isPentagon = false;
  state.cells.set('cell_0', c0);

  const c1 = new CellState();
  c1.cellId = 'cell_1';
  c1.biome = TerrainType.MOUNTAIN;
  c1.ownerId = 'p1';
  c1.elevation = 0.7;
  c1.resourceType = ResourceType.ORE;
  c1.resourceAmount = 2;
  c1.isPentagon = false;
  state.cells.set('cell_1', c1);

  const c2 = new CellState();
  c2.cellId = 'cell_2';
  c2.biome = TerrainType.OCEAN;
  c2.elevation = -0.5;
  c2.isPentagon = false;
  state.cells.set('cell_2', c2);

  const c3 = new CellState();
  c3.cellId = 'cell_3';
  c3.biome = TerrainType.FOREST;
  c3.ownerId = '';
  c3.elevation = 0.2;
  c3.isPentagon = false;
  state.cells.set('cell_3', c3);

  const c4 = new CellState();
  c4.cellId = 'cell_4';
  c4.biome = TerrainType.DESERT;
  c4.ownerId = 'p1';
  c4.elevation = 0.2;
  c4.isPentagon = false;
  state.cells.set('cell_4', c4);

  return state;
}

function makeTestCity(state: GameState, cellId: string, tier: number = 1): CityState {
  const city = new CityState();
  city.cityId = 'city_0';
  city.ownerId = 'p1';
  city.cellId = cellId;
  city.tier = tier;
  city.population = 10;
  city.foodPerTick = 1;
  city.energyPerTick = 1;
  initCityStockpile(city);
  state.cities.set(city.cityId, city);

  const cell = state.cells.get(cellId);
  if (cell) {
    cell.hasCity = true;
    cell.cityId = city.cityId;
  }

  return city;
}

describe('Cell Building Capacity', () => {
  it('should return correct capacity for each biome', () => {
    const state = makeTestState();
    const c0 = state.cells.get('cell_0')!;
    expect(getCellBuildingCapacity(c0)).toBe(6); // PLAINS

    const c1 = state.cells.get('cell_1')!;
    expect(getCellBuildingCapacity(c1)).toBe(3); // MOUNTAIN

    const c4 = state.cells.get('cell_4')!;
    expect(getCellBuildingCapacity(c4)).toBe(4); // DESERT
  });

  it('should return 5 for pentagons', () => {
    const cell = new CellState();
    cell.biome = TerrainType.PLAINS;
    cell.isPentagon = true;
    expect(getCellBuildingCapacity(cell)).toBe(5);
  });

  it('should return 0 for ocean', () => {
    const state = makeTestState();
    const c2 = state.cells.get('cell_2')!;
    expect(getCellBuildingCapacity(c2)).toBe(0);
  });
});

describe('Building Placement', () => {
  it('should allow farm on plains', () => {
    const state = makeTestState();
    const result = canPlaceBuilding(state, 'cell_0', 'FARM', 'p1');
    expect(result).toBe(true);
  });

  it('should allow mine on mountain', () => {
    const state = makeTestState();
    const result = canPlaceBuilding(state, 'cell_1', 'MINE', 'p1');
    expect(result).toBe(true);
  });

  it('should allow oil well on desert', () => {
    const state = makeTestState();
    const result = canPlaceBuilding(state, 'cell_4', 'OIL_WELL', 'p1');
    expect(result).toBe(true);
  });

  it('should not allow farm on ocean', () => {
    const state = makeTestState();
    const result = canPlaceBuilding(state, 'cell_2', 'FARM', 'p1');
    expect(result).toBe(false);
  });

  it('should not allow building on unowned cell', () => {
    const state = makeTestState();
    const result = canPlaceBuilding(state, 'cell_3', 'FARM', 'p1');
    expect(result).toBe(false);
  });

  it('should create a building and count it on cell', () => {
    const state = makeTestState();
    const building = createBuilding(state, 'p1', 'cell_0', 'FARM');
    expect(building).not.toBeNull();
    expect(building!.type).toBe('FARM');
    expect(building!.productionTicksRemaining).toBe(200);
    expect(countBuildingsOnCell(state, 'cell_0')).toBe(1);
  });

  it('should allow multiple buildings up to capacity', () => {
    const state = makeTestState();
    const b1 = createBuilding(state, 'p1', 'cell_0', 'FARM');
    expect(b1).not.toBeNull();
    expect(countBuildingsOnCell(state, 'cell_0')).toBe(1);
  });

  it('should not exceed cell capacity', () => {
    const state = makeTestState();
    for (let i = 0; i < 6; i++) {
      const b = createBuilding(state, 'p1', 'cell_0', 'FARM');
      if (i < 6) expect(b).not.toBeNull();
    }
    expect(countBuildingsOnCell(state, 'cell_0')).toBe(6);
    const extra = createBuilding(state, 'p1', 'cell_0', 'FARM');
    expect(extra).toBeNull();
  });
});

describe('Building Production', () => {
  it('should complete production after correct number of ticks', () => {
    const state = makeTestState();
    const building = createBuilding(state, 'p1', 'cell_0', 'FARM');
    expect(building!.productionTicksRemaining).toBe(200);

    for (let i = 0; i < 199; i++) {
      const done = tickBuildingProduction(building!);
      expect(done).toBe(false);
    }
    const done = tickBuildingProduction(building!);
    expect(done).toBe(true);
    expect(building!.productionTicksRemaining).toBe(0);
  });
});

describe('City Stockpile', () => {
  it('should initialize with starting resources', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0');
    expect(getCityStockpileAmount(city, ResourceType.BREAD)).toBe(80);
    expect(getCityStockpileAmount(city, ResourceType.STEEL)).toBe(10);
    expect(getCityStockpileAmount(city, ResourceType.POWER)).toBe(20);
  });

  it('should add and consume resources', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0');
    addToCityStockpile(city, ResourceType.BREAD, 20);
    expect(getCityStockpileAmount(city, ResourceType.BREAD)).toBe(100);
    const result = consumeFromCityStockpile(city, ResourceType.BREAD, 15);
    expect(result).toBe(true);
    expect(getCityStockpileAmount(city, ResourceType.BREAD)).toBe(85);
  });

  it('should fail to consume when insufficient', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0');
    const result = consumeFromCityStockpile(city, ResourceType.STEEL, 100);
    expect(result).toBe(false);
    expect(getCityStockpileAmount(city, ResourceType.STEEL)).toBe(10);
  });
});

describe('Building Stockpile', () => {
  it('should add and read resources on buildings', () => {
    const state = makeTestState();
    const building = createBuilding(state, 'p1', 'cell_0', 'FACTORY');
    building!.productionTicksRemaining = 0;
    addToBuildingStockpile(building!, ResourceType.GRAIN, 10);
    expect(getBuildingStockpileAmount(building!, ResourceType.GRAIN)).toBe(10);
  });
});

describe('Extractor Output', () => {
  it('should deliver raw resources to nearest city', () => {
    const state = makeTestState();
    makeTestCity(state, 'cell_0');

    const c1 = state.cells.get('cell_1')!;
    c1.isPentagon = false;

    const building = createBuilding(state, 'p1', 'cell_1', 'MINE');
    building!.productionTicksRemaining = 0;

    const adjMap: Record<string, string[]> = { 'cell_0': ['cell_1'], 'cell_1': ['cell_0'] };
    tickExtractorOutput(state, adjMap);

    const city = state.cities.get('city_0')!;
    expect(getCityStockpileAmount(city, ResourceType.ORE)).toBeGreaterThan(0);
  });
});

describe('Population Growth', () => {
  it('should grow population when food is satisfied', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0', 1);
    city.foodPerTick = 10;
    city.energyPerTick = 5;
    city.population = 10;

    for (let i = 0; i < 500; i++) {
      tickPopulation(state);
    }

    expect(city.population).toBeGreaterThan(10);
  });

  it('should decline population when food is below threshold', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0', 1);
    city.foodPerTick = 0;
    city.population = 100;

    for (let i = 0; i < 100; i++) {
      tickPopulation(state);
    }

    expect(city.population).toBeLessThan(100);
  });

  it('should not exceed population cap', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0', 1);
    city.foodPerTick = 100;
    city.population = 49;

    for (let i = 0; i < 10000; i++) {
      tickPopulation(state);
    }

    expect(city.population).toBeLessThanOrEqual(50);
  });
});

describe('City XP', () => {
  it('should accumulate XP based on population', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0', 1);
    city.population = 50;
    city.foodPerTick = 5;
    city.energyPerTick = 3;

    tickCityXP(state);
    expect(city.xp).toBeGreaterThan(0);
  });

  it('should upgrade tier when XP threshold is met', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0', 1);
    city.population = 500;
    city.foodPerTick = 100;
    city.energyPerTick = 50;

    for (let i = 0; i < 1000; i++) {
      tickCityXP(state);
    }

    expect(city.tier).toBeGreaterThan(1);
  });
});

describe('Available Build Types', () => {
  it('should return farm and factory for plains at level 2', () => {
    const state = makeTestState();
    const types = getAvailableBuildTypes(state, 'cell_0', 'p1', 2);
    expect(types).toContain('FARM');
    expect(types).toContain('FACTORY');
  });

  it('should return factory for plains at level 1', () => {
    const state = makeTestState();
    const types = getAvailableBuildTypes(state, 'cell_0', 'p1', 1);
    expect(types).toContain('FARM');
    expect(types).toContain('FACTORY');
    expect(types).toContain('CITY');
  });

  it('should return mine for mountain', () => {
    const state = makeTestState();
    const types = getAvailableBuildTypes(state, 'cell_1', 'p1');
    expect(types).toContain('MINE');
  });

  it('should return oil well for desert at level 1', () => {
    const state = makeTestState();
    const types = getAvailableBuildTypes(state, 'cell_4', 'p1', 1);
    expect(types).toContain('OIL_WELL');
  });
});

describe('Engineer Level Gating', () => {
  it('should allow factory at level 1', () => {
    const state = makeTestState();
    const result = canPlaceBuilding(state, 'cell_0', 'FACTORY', 'p1', 1);
    expect(result).toBe(true);
  });

  it('should allow factory at level 2', () => {
    const state = makeTestState();
    const result = canPlaceBuilding(state, 'cell_0', 'FACTORY', 'p1', 2);
    expect(result).toBe(true);
  });

  it('should allow city at level 1', () => {
    const state = makeTestState();
    const result = canPlaceBuilding(state, 'cell_0', 'CITY', 'p1', 1);
    expect(result).toBe(true);
  });
});

describe('Gradual Building Construction', () => {
  it('should drain resources per tick toward building cost', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0');
    const building = createBuilding(state, 'p1', 'cell_4', 'OIL_WELL');
    expect(building).not.toBeNull();
    expect(building!.productionTicksRemaining).toBe(350);

    const adjMap: Record<string, string[]> = { 'cell_0': ['cell_4'], 'cell_4': ['cell_0'] };

    const investedBefore = getResourcesInvested(building!);
    expect(investedBefore.food).toBe(0);
    expect(investedBefore.material).toBe(0);

    tickBuildingConstruction(state, building!, adjMap);

    const investedAfter = getResourcesInvested(building!);
    expect(investedAfter.food).toBeGreaterThan(0);
    expect(investedAfter.material).toBeGreaterThan(0);
  });

  it('should stall construction when city cannot afford per-tick cost', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0');
    const sp = getCityStockpile(city);
    sp['BREAD'] = 0;
    sp['GRAIN'] = 0;
    sp['ORE'] = 0;
    sp['STEEL'] = 0;
    setCityStockpile(city, sp);

    const building = createBuilding(state, 'p1', 'cell_4', 'OIL_WELL');
    expect(building).not.toBeNull();

    const adjMap: Record<string, string[]> = { 'cell_0': ['cell_4'], 'cell_4': ['cell_0'] };
    const ticksBefore = building!.productionTicksRemaining;

    const completed = tickBuildingConstruction(state, building!, adjMap);
    expect(completed).toBe(false);
    expect(building!.productionTicksRemaining).toBe(ticksBefore);

    const invested = getResourcesInvested(building!);
    expect(invested.food).toBe(0);
    expect(invested.material).toBe(0);
  });

  it('should mark construction complete when all resources paid and ticks elapsed', () => {
    const state = makeTestState();
    const city = makeTestCity(state, 'cell_0');
    const building = createBuilding(state, 'p1', 'cell_4', 'OIL_WELL');
    expect(building).not.toBeNull();

    building!.productionTicksRemaining = 2;

    const adjMap: Record<string, string[]> = { 'cell_0': ['cell_4'], 'cell_4': ['cell_0'] };

    tickBuildingConstruction(state, building!, adjMap);
    tickBuildingConstruction(state, building!, adjMap);

    expect(building!.productionTicksRemaining).toBe(0);
  });

  it('should validate canAffordBuildingCost correctly', () => {
    const state = makeTestState();
    makeTestCity(state, 'cell_0');

    const adjMap: Record<string, string[]> = { 'cell_0': ['cell_4'], 'cell_4': ['cell_0'] };

    expect(canAffordBuildingCost(state, 'cell_1', 'MINE', 'p1', adjMap)).toBe(true);

    const state2 = makeTestState();
    const city = makeTestCity(state2, 'cell_0');
    const sp = getCityStockpile(city);
    sp['BREAD'] = 0;
    sp['GRAIN'] = 0;
    setCityStockpile(city, sp);

    const adjMap2: Record<string, string[]> = { 'cell_0': ['cell_4'], 'cell_4': ['cell_0'] };
    expect(canAffordBuildingCost(state2, 'cell_4', 'OIL_WELL', 'p1', adjMap2)).toBe(false);
  });

  it('should allow free buildings (FARM) without resource checks', () => {
    const state = makeTestState();
    const adjMap: Record<string, string[]> = { 'cell_0': [] };

    expect(canAffordBuildingCost(state, 'cell_0', 'FARM', 'p1', adjMap)).toBe(true);
  });
});