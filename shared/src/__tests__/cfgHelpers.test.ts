import { describe, it, expect } from 'vitest';
import { CFG } from '../CFG';
import {
  getPassableTerrain,
  getMovementCost,
  getCellBuildingCapacity,
  getFoodValue,
  getMaterialValue,
  getRawResources,
  getProcessedResources,
  getResourceCategoryMap,
  getResourceCategories,
} from '../cfgHelpers';
import { ResourceType } from '../types';

describe('getPassableTerrain', () => {
  it('includes PLAINS, FOREST, MOUNTAIN, DESERT, TUNDRA, PENTAGON', () => {
    const result = getPassableTerrain(CFG);
    expect(result).toContain('PLAINS');
    expect(result).toContain('FOREST');
    expect(result).toContain('MOUNTAIN');
    expect(result).toContain('DESERT');
    expect(result).toContain('TUNDRA');
    expect(result).toContain('PENTAGON');
  });

  it('excludes OCEAN', () => {
    const result = getPassableTerrain(CFG);
    expect(result).not.toContain('OCEAN');
  });
});

describe('getMovementCost', () => {
  it('returns cost for each terrain', () => {
    const costs = getMovementCost(CFG);
    expect(costs.PLAINS).toBe(30);
    expect(costs.OCEAN).toBe(Infinity);
  });
});

describe('getCellBuildingCapacity', () => {
  it('returns capacity for each terrain', () => {
    const cap = getCellBuildingCapacity(CFG);
    expect(cap.PLAINS).toBe(6);
    expect(cap.OCEAN).toBe(0);
    expect(cap.MOUNTAIN).toBe(3);
  });
});

describe('getFoodValue / getMaterialValue', () => {
  it('returns food values for resources with foodValue > 0', () => {
    const fv = getFoodValue(CFG);
    expect(fv.GRAIN).toBe(0.67);
    expect(fv.BREAD).toBe(1.0);
    expect(fv.OIL).toBe(0.5);
    expect(fv.ORE).toBeUndefined();
  });

  it('returns material values for resources with materialValue > 0', () => {
    const mv = getMaterialValue(CFG);
    expect(mv.ORE).toBe(1.0);
    expect(mv.STEEL).toBe(1.5);
    expect(mv.GRAIN).toBeUndefined();
  });
});

describe('getRawResources / getProcessedResources', () => {
  it('separates raw and processed resources', () => {
    const raw = getRawResources(CFG);
    const processed = getProcessedResources(CFG);
    expect(raw).toContain(ResourceType.GRAIN);
    expect(raw).toContain(ResourceType.ORE);
    expect(processed).toContain(ResourceType.BREAD);
    expect(processed).toContain(ResourceType.STEEL);
    expect(raw).not.toContain(ResourceType.BREAD);
    expect(processed).not.toContain(ResourceType.GRAIN);
  });
});

describe('getResourceCategoryMap', () => {
  it('maps each resource to its category', () => {
    const map = getResourceCategoryMap(CFG);
    expect(map.GRAIN).toBe('FOOD');
    expect(map.ORE).toBe('INDUSTRY');
    expect(map.OIL).toBe('ENERGY');
    expect(map.POWER).toBe('ENERGY');
  });
});

describe('getResourceCategories', () => {
  it('derives categories from RESOURCES.*.category', () => {
    const cats = getResourceCategories(CFG);
    expect(Object.keys(cats)).toEqual(expect.arrayContaining(['FOOD', 'INDUSTRY', 'ENERGY']));
    expect(cats.FOOD.label).toBe('Food');
    expect(cats.FOOD.resources).toEqual(expect.arrayContaining([ResourceType.BREAD, ResourceType.GRAIN]));
    expect(cats.INDUSTRY.resources).toEqual(expect.arrayContaining([ResourceType.ORE, ResourceType.STEEL, ResourceType.TIMBER, ResourceType.LUMBER]));
    expect(cats.ENERGY.resources).toEqual(expect.arrayContaining([ResourceType.POWER]));
  });
});