import { describe, it, expect } from 'vitest';
import { CFG } from '../CFG';
import {
  getPassableTerrain,
  getMovementCost,
  getCellBuildingCapacity,
  getBuildingTicks,
  getBuildingCosts,
  getBuildingPlacementRules,
  getExtractorOutput,
  getExtractorTypes,
  getFoodValue,
  getMaterialValue,
  getRawResources,
  getProcessedResources,
  getResourceCategoryMap,
  getResourceCategories,
  getFactoryRecipes,
  getUnitBuildableTypes,
  getInfantryBuildableTypes,
  getEngineerBuildableTypes,
  getUnitProductionCosts,
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

describe('getBuildingTicks', () => {
  it('returns ticks for each building', () => {
    const ticks = getBuildingTicks(CFG);
    expect(ticks.FARM).toBe(200);
    expect(ticks.CITY).toBe(500);
    expect(ticks.FACTORY).toBe(400);
  });
});

describe('getBuildingCosts', () => {
  it('returns costs for each building', () => {
    const costs = getBuildingCosts(CFG);
    expect(costs.FARM).toEqual({ food: 0, material: 0, consumesBuilder: true });
    expect(costs.CITY).toEqual({ food: 80, material: 40, consumesBuilder: true });
    expect(costs.RUIN_RESTORE.consumesBuilder).toBe(false);
  });
});

describe('getBuildingPlacementRules', () => {
  it('returns placement rules for buildings with placement', () => {
    const rules = getBuildingPlacementRules(CFG);
    expect(rules.FARM).toEqual(['PLAINS', 'FOREST']);
    expect(rules.RUIN_RESTORE).toBeUndefined();
  });
});

describe('getExtractorOutput', () => {
  it('returns output only for extractor buildings', () => {
    const output = getExtractorOutput(CFG);
    expect(output.FARM).toEqual({ resource: ResourceType.GRAIN, amount: 3 });
    expect(output.FACTORY).toBeUndefined();
  });
});

describe('getExtractorTypes', () => {
  it('returns infantry-buildable buildings with zero cost', () => {
    const types = getExtractorTypes(CFG);
    expect(types).toContain('FARM');
    expect(types).toContain('MINE');
    expect(types).toContain('LUMBER_CAMP');
    expect(types).not.toContain('OIL_WELL');
    expect(types).not.toContain('FACTORY');
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

describe('getFactoryRecipes', () => {
  it('derives recipes from RESOURCES.*.recipe', () => {
    const recipes = getFactoryRecipes(CFG);
    expect(recipes.length).toBe(4);
    const bake = recipes.find(r => r.id === 'bake');
    expect(bake).toBeDefined();
    expect(bake!.input[0].resource).toBe(ResourceType.GRAIN);
    expect(bake!.output[0].resource).toBe(ResourceType.BREAD);
    expect(bake!.ticksPerCycle).toBe(50);
  });

  it('includes smelt, refine, and mill recipes', () => {
    const recipes = getFactoryRecipes(CFG);
    const ids = recipes.map(r => r.id);
    expect(ids).toEqual(expect.arrayContaining(['bake', 'smelt', 'refine', 'mill']));
  });
});

describe('getUnitBuildableTypes', () => {
  it('returns all buildable types for infantry at level 1', () => {
    const types = getUnitBuildableTypes(CFG, 'INFANTRY', 1);
    expect(types).toEqual(expect.arrayContaining(['FARM', 'MINE', 'LUMBER_CAMP', 'RUIN_RESTORE']));
    expect(types).not.toContain('FACTORY');
    expect(types).not.toContain('CITY');
  });

  it('returns level-gated types for engineers', () => {
    const eng1 = getUnitBuildableTypes(CFG, 'ENGINEER', 1);
    const eng2 = getUnitBuildableTypes(CFG, 'ENGINEER', 2);
    expect(eng1).not.toContain('FACTORY');
    expect(eng1).not.toContain('CITY');
    expect(eng2).toEqual(expect.arrayContaining(['FACTORY', 'CITY']));
  });

  it('returns empty for unknown unit type', () => {
    expect(getUnitBuildableTypes(CFG, 'TRADER', 1)).toEqual([]);
  });
});

describe('getInfantryBuildableTypes / getEngineerBuildableTypes', () => {
  it('delegates to getUnitBuildableTypes', () => {
    expect(getInfantryBuildableTypes(CFG)).toEqual(getUnitBuildableTypes(CFG, 'INFANTRY', 1));
    expect(getEngineerBuildableTypes(CFG, 2)).toEqual(getUnitBuildableTypes(CFG, 'ENGINEER', 2));
  });
});

describe('getUnitProductionCosts', () => {
  it('returns costs for all unit types', () => {
    const costs = getUnitProductionCosts(CFG);
    expect(costs.length).toBeGreaterThanOrEqual(2);
    const inf = costs.find(c => c.type === 'INFANTRY');
    expect(inf).toBeDefined();
    expect(inf!.ticksCost).toBe(100);
    expect(inf!.popCost).toBe(1);
  });
});