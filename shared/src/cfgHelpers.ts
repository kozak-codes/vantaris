// ──────────────────────────────────────────────
// cfgHelpers.ts — Pure derived computations from a
// given ICFG.  Every function takes `cfg` as its
// first argument and returns a new value with no
// side effects.  This enables future game
// configuration by swapping the CFG object.
//
// DRY PRINCIPLE (mandatory):
//   If a pattern appears more than twice, refactor
//   it into a shared procedural helper.  For example,
//   getInfantryBuildableTypes / getEngineerBuildableTypes
//   both walk cfg.UNITS[type].buildable — so the
//   unified getUnitBuildableTypes() is the canonical
//   caller.  When adding new unit types (TRADER, etc.),
//   only getUnitBuildableTypes needs to know about
//   the new type — the others are already DRY.
//
//   Similarly, iterating cfg.RESOURCES to filter by
//   tier/category/value is factored into
//   getResourcesByTier / getResourcesByCategory
//   rather than duplicating the loop everywhere.
//
// ADDING NEW HELPERS:
//   1. Keep the function pure (no global CFG access).
//   2. Take cfg: ICFG as the first parameter.
//   3. If you find yourself writing a similar loop
//      for the third time, extract a shared helper.
//   4. Write unit tests for new helpers — see
//      shared/src/__tests__/cfgHelpers.test.ts.
// ──────────────────────────────────────────────

import type { ICFG, TerrainConfig, BuildingConfig, ResourceConfig, UnitConfig } from './CFG';
import { ResourceType, type ResourceType as RT } from './types';

// ─── Internal shared helpers (DRY) ───────────

type ResourcePredicate = (key: string, val: ResourceConfig) => boolean;

function filterResources(cfg: ICFG, pred: ResourcePredicate): string[] {
  const result: string[] = [];
  for (const [key, val] of Object.entries(cfg.RESOURCES) as [string, ResourceConfig][]) {
    if (pred(key, val)) result.push(key);
  }
  return result;
}

function getResourceFieldMap(cfg: ICFG, field: 'foodValue' | 'materialValue'): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(cfg.RESOURCES) as [string, ResourceConfig][]) {
    const v = val[field];
    if (v !== undefined && v > 0) result[key] = v;
  }
  return result;
}

// ─── Terrain helpers ─────────────────────────

export function getPassableTerrain(cfg: ICFG): string[] {
  return (Object.entries(cfg.TERRAIN) as [string, TerrainConfig][])
    .filter(([, t]) => t.passable)
    .map(([k]) => k);
}

export function getMovementCost(cfg: ICFG): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, t] of Object.entries(cfg.TERRAIN) as [string, TerrainConfig][]) {
    result[key] = t.cost;
  }
  return result;
}

export function getCellBuildingCapacity(cfg: ICFG): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, t] of Object.entries(cfg.TERRAIN) as [string, TerrainConfig][]) {
    result[key] = t.capacity;
  }
  return result;
}

// ─── Building helpers ────────────────────────

export function getBuildingTicks(cfg: ICFG): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(cfg.BUILDINGS) as [string, BuildingConfig][]) {
    result[key] = val.ticks;
  }
  return result;
}

export function getBuildingCosts(cfg: ICFG): Record<string, { food: number; material: number; consumesBuilder: boolean }> {
  const result: Record<string, { food: number; material: number; consumesBuilder: boolean }> = {};
  for (const [key, val] of Object.entries(cfg.BUILDINGS) as [string, BuildingConfig][]) {
    result[key] = { food: val.cost.food, material: val.cost.material, consumesBuilder: val.cost.consumesBuilder };
  }
  return result;
}

export function getBuildingPlacementRules(cfg: ICFG): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(cfg.BUILDINGS) as [string, BuildingConfig][]) {
    if (val.placement.length > 0) result[key] = [...val.placement];
  }
  return result;
}

export function getExtractorOutput(cfg: ICFG): Record<string, { resource: ResourceType; amount: number }> {
  const result: Record<string, { resource: ResourceType; amount: number }> = {};
  for (const [key, val] of Object.entries(cfg.BUILDINGS) as [string, BuildingConfig][]) {
    if (val.extractorOutput) {
      result[key] = { resource: val.extractorOutput.resource, amount: val.extractorOutput.amount };
    }
  }
  return result;
}

export function getExtractorTypes(cfg: ICFG): string[] {
  return getUnitBuildableTypes(cfg, 'INFANTRY', 1).filter(
    (key) => cfg.BUILDINGS[key]?.cost.food === 0 && cfg.BUILDINGS[key]?.cost.material === 0,
  );
}

// ─── Resource helpers ────────────────────────

export function getFoodValue(cfg: ICFG): Record<string, number> {
  return getResourceFieldMap(cfg, 'foodValue');
}

export function getMaterialValue(cfg: ICFG): Record<string, number> {
  return getResourceFieldMap(cfg, 'materialValue');
}

export function getRawResources(cfg: ICFG): RT[] {
  return filterResources(cfg, (_, val) => val.tier === 'raw') as RT[];
}

export function getProcessedResources(cfg: ICFG): RT[] {
  return filterResources(cfg, (_, val) => val.tier === 'processed') as RT[];
}

export function getResourceCategoryMap(cfg: ICFG): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(cfg.RESOURCES) as [string, ResourceConfig][]) {
    if (val.category) result[key] = val.category;
  }
  return result;
}

export function getResourceCategories(cfg: ICFG): Record<string, { label: string; resources: RT[] }> {
  const buckets: Record<string, RT[]> = {};
  for (const [key, val] of Object.entries(cfg.RESOURCES) as [string, ResourceConfig][]) {
    if (val.category) {
      if (!buckets[val.category]) buckets[val.category] = [];
      buckets[val.category].push(key as RT);
    }
  }
  const result: Record<string, { label: string; resources: RT[] }> = {};
  for (const [cat, resources] of Object.entries(buckets)) {
    result[cat] = {
      label: cfg.RESOURCE_CATEGORY_LABELS[cat] ?? cat,
      resources,
    };
  }
  return result;
}

export function getFactoryRecipes(cfg: ICFG): { id: string; name: string; input: { resource: ResourceType; amount: number }[]; output: { resource: ResourceType; amount: number }[]; ticksPerCycle: number; minFactoryTier: number }[] {
  const result: { id: string; name: string; input: { resource: ResourceType; amount: number }[]; output: { resource: ResourceType; amount: number }[]; ticksPerCycle: number; minFactoryTier: number }[] = [];
  for (const [key, val] of Object.entries(cfg.RESOURCES) as [string, ResourceConfig][]) {
    if (val.recipe) {
      const r = val.recipe;
      const id = r.id ?? key.toLowerCase();
      const name = r.name ?? key.charAt(0) + key.slice(1).toLowerCase();
      result.push({ id, name, input: r.input, output: r.output, ticksPerCycle: r.ticksPerCycle, minFactoryTier: r.minFactoryTier });
    }
  }
  return result;
}

// ─── Unit helpers ─────────────────────────────

export function getUnitBuildableTypes(cfg: ICFG, unitType: string, unitLevel: number): string[] {
  const unit = cfg.UNITS[unitType];
  if (!unit?.buildable) return [];
  const result: string[] = [];
  for (const [buildingType, req] of Object.entries(unit.buildable)) {
    if (req.minLevel <= unitLevel) result.push(buildingType);
  }
  return result;
}

export function getInfantryBuildableTypes(cfg: ICFG): string[] {
  return getUnitBuildableTypes(cfg, 'INFANTRY', 1);
}

export function getEngineerBuildableTypes(cfg: ICFG, engineerLevel: number): string[] {
  return getUnitBuildableTypes(cfg, 'ENGINEER', engineerLevel);
}

export function getUnitProductionCosts(cfg: ICFG): { type: string; ticksCost: number; resourceCost: Record<string, number>; manpowerCost: number }[] {
  const result: { type: string; ticksCost: number; resourceCost: Record<string, number>; manpowerCost: number }[] = [];
  for (const [key, val] of Object.entries(cfg.UNITS) as [string, UnitConfig][]) {
    result.push({ type: key, ticksCost: val.ticksCost, resourceCost: { ...val.resourceCost }, manpowerCost: val.manpowerCost });
  }
  return result;
}