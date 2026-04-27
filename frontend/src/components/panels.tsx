import { FunctionalComponent } from 'preact';
import { useSignal, useComputed, useSignalEffect } from '@preact/signals';
import { CFG, getResourceCategoryMap, getBuildingCosts, getBuildingPlacementRules, getUnitProductionCosts, getUnitBuildableTypes } from '@vantaris/shared';
import type { TerrainType, CityData, VisibleCellData } from '@vantaris/shared';
import {
  selectedCellData, selectedUnit, selectedCity, myPlayerId,
  pendingCommand, unitsOnSelectedTile, buildingsOnSelectedTile,
  selectUnit, selectCity, selectTile,
} from '../state/signals';

const RESOURCE_CATEGORY_MAP = getResourceCategoryMap(CFG);
const BUILDING_COSTS = getBuildingCosts(CFG);
const BUILDING_PLACEMENT_RULES = getBuildingPlacementRules(CFG);
const UNIT_PRODUCTION_COSTS = getUnitProductionCosts(CFG);

const RESOURCE_LABELS: Record<string, string> = {
  BREAD: 'Bread', GRAIN: 'Grain', ORE: 'Ore', STEEL: 'Steel',
  OIL: 'Oil', POWER: 'Power', TIMBER: 'Timber', LUMBER: 'Lumber',
};

const BIOME_TRAVEL_NAMES: Record<string, string> = {
  PLAINS: 'Plains', FOREST: 'Forest', MOUNTAIN: 'Mountain',
  DESERT: 'Desert', TUNDRA: 'Tundra', OCEAN: 'Ocean', PENTAGON: 'Pentagon',
};

const round1 = (v: number) => Math.round(v * 10) / 10;

const sendMoveUnit = (unitId: string, targetCellId: string) => {
  (window as any).__vantaris_sendMoveUnit?.(unitId, targetCellId);
};
const sendClaimTerritory = (unitId: string, cellId: string) => {
  (window as any).__vantaris_sendClaimTerritory?.(unitId, cellId);
};
const sendBuildStructure = (unitId: string, cellId: string, buildingType: string) => {
  (window as any).__vantaris_sendBuildStructure?.(unitId, cellId, buildingType);
};
const sendRestoreRuin = (unitId: string, cellId: string) => {
  (window as any).__vantaris_sendRestoreRuin?.(unitId, cellId);
};

interface StockpileSectionProps {
  city: CityData;
}

const StockpileSection: FunctionalComponent<StockpileSectionProps> = ({ city }) => {
  const CATEGORY_ORDER = ['FOOD', 'INDUSTRY', 'ENERGY', 'POPULATION'];
  const CATEGORY_LABELS: Record<string, string> = { FOOD: 'Food', INDUSTRY: 'Industry', ENERGY: 'Energy', POPULATION: 'Population' };
  const CATEGORY_ICONS: Record<string, string> = { FOOD: '\u{1F33E}', INDUSTRY: '\u2692', ENERGY: '\u26A1', POPULATION: '\u{1F465}' };

  const categoryStockpile: Record<string, { resources: { resource: string; amount: number; label: string }[]; total: number }> = {};
  const inflowMap: Record<string, { total: number; sources: { source: string; amount: number }[] }> = {};
  for (const cat of CATEGORY_ORDER) {
    categoryStockpile[cat] = { resources: [], total: 0 };
    inflowMap[cat] = { total: 0, sources: [] };
  }
  for (const entry of city.stockpile) {
    const cat = RESOURCE_CATEGORY_MAP[entry.resource] || 'INDUSTRY';
    const label = RESOURCE_LABELS[entry.resource] || entry.resource;
    categoryStockpile[cat].resources.push({ resource: entry.resource, amount: round1(entry.amount), label });
    categoryStockpile[cat].total += entry.amount;
  }
  for (const inflow of (city.resourceInflows || [])) {
    const cat = RESOURCE_CATEGORY_MAP[inflow.resource] || 'INDUSTRY';
    const existing = inflowMap[cat].sources.find(s => s.source === inflow.source);
    if (existing) {
      existing.amount = round1(existing.amount + inflow.amount);
    } else {
      inflowMap[cat].sources.push({ source: inflow.source, amount: round1(inflow.amount) });
    }
    inflowMap[cat].total = round1(inflowMap[cat].total + inflow.amount);
  }

  const foodSatPct = Math.round(city.foodPerTick * 100);
  const energySatPct = Math.round(city.energyPerTick * 100);
  const popGrowthRate = city.foodPerTick >= 1.0
    ? CFG.CITY.POPULATION_GROWTH_BASE + CFG.CITY.POPULATION_GROWTH_FOOD_BONUS * city.foodPerTick
    : 0;

  return (
    <div class="panel-section">
      <div class="panel-subtitle">Stockpile</div>
      {CATEGORY_ORDER.map(cat => {
        if (cat === 'POPULATION') {
          const popLabel = popGrowthRate > 0 ? `${city.population} (+${round1(popGrowthRate)}/t)` : `${city.population}`;
          return (
            <div class="panel-row stockpile-category">
              <span class="label">{CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}</span>
              <span>{popLabel}</span>
            </div>
          );
        }
        const data = categoryStockpile[cat];
        if (data.resources.length === 0 && cat !== 'ENERGY') return null;

        let satLabel = '';
        if (cat === 'FOOD') satLabel = foodSatPct !== 100 ? ` (${foodSatPct}%)` : '';
        if (cat === 'ENERGY') satLabel = energySatPct !== 100 ? ` (${energySatPct}%)` : '';

        const inflow = inflowMap[cat];
        const inflowTooltip = inflow.sources.length > 0
          ? inflow.sources.map(s => `${s.source}: +${round1(s.amount)}`).join('\n')
          : '';
        const inflowLabel = inflow.total > 0 ? ` (+${round1(inflow.total)}/100t)` : '';

        return (
          <div class="panel-row stockpile-category" title={inflowTooltip}>
            <span class="label">{CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}{satLabel}</span>
            <span>{round1(data.total)}{inflowLabel}</span>
          </div>
        );
      })}
    </div>
  );
};

interface BuildMenuProps {
  cellData: VisibleCellData;
  tileId: string;
}

const BuildMenu: FunctionalComponent<BuildMenuProps> = ({ cellData, tileId }) => {
  if (!cellData || cellData.ownerId !== myPlayerId.value) return null;

  const ruinRestore = cellData.ruin && cellData.ruinRevealed;
  const buildOptions: { type: string; label: string; cost: string }[] = [];

  const unitsHere = unitsOnSelectedTile.value;
  for (const unit of unitsHere) {
    if (unit.ownerId !== myPlayerId.value || unit.status !== 'IDLE') continue;
    const canBuild = getUnitBuildableTypes(CFG, unit.type, unit.type === 'ENGINEER' ? (unit as any).engineerLevel ?? 1 : 1);
    for (const bt of canBuild) {
      if (ruinRestore && bt !== 'RUIN_RESTORE') continue;
      if (bt === 'RUIN_RESTORE' && !ruinRestore) continue;
      const allowedBiomes = BUILDING_PLACEMENT_RULES[bt];
      if (allowedBiomes && !allowedBiomes.includes(cellData.biome)) continue;
      if (bt === 'CITY' && cellData.buildings.some((b: any) => b.type === 'CITY')) continue;
      const cost = BUILDING_COSTS[bt];
      if (!cost) continue;
      buildOptions.push({ type: bt, label: bt.replace('_', ' '), cost: `F:${cost.food} M:${cost.material}` });
    }
    break;
  }

  if (buildOptions.length === 0 && !ruinRestore) return null;

  return (
    <div class="panel-section">
      <div class="panel-subtitle">Build</div>
      {ruinRestore && (
        <button class="panel-btn cmd-btn" onClick={() => {
          const unit = unitsOnSelectedTile.value.find(u => u.ownerId === myPlayerId.value && u.status === 'IDLE');
          if (unit) sendRestoreRuin(unit.unitId, tileId);
        }}>3 Restore<span class="cmd-key">3</span></button>
      )}
      {buildOptions.filter(o => o.type !== 'RUIN_RESTORE').map(o => (
        <button class="panel-btn cmd-btn" onClick={() => {
          const unit = unitsOnSelectedTile.value.find(u => u.ownerId === myPlayerId.value && u.status === 'IDLE');
          if (unit) sendBuildStructure(unit.unitId, tileId, o.type);
        }}>{o.label} <span class="build-option-cost">{o.cost}</span></button>
      ))}
    </div>
  );
};

export { StockpileSection, BuildMenu };