// ──────────────────────────────────────────────
// cfgHelpers.ts — Pure derived computations from a
// given ICFG.  Every function takes `cfg` as its
// first argument and returns a new value with no
// side effects.
// ──────────────────────────────────────────────

import type { ICFG, ResourceConfig } from './CFG';
import { type ResourceType as RT } from './types';

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