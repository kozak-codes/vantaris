import { FunctionalComponent } from 'preact';
import { CFG, getResourceCategoryMap } from '@vantaris/shared';
import type { CityData } from '@vantaris/shared';

const RESOURCE_CATEGORY_MAP = getResourceCategoryMap(CFG);

const CATEGORY_ORDER = ['FOOD', 'INDUSTRY', 'ENERGY', 'POPULATION'];
const CATEGORY_LABELS: Record<string, string> = { FOOD: 'Food', INDUSTRY: 'Industry', ENERGY: 'Energy', POPULATION: 'Population' };
const CATEGORY_ICONS: Record<string, string> = { FOOD: '\u{1F33E}', INDUSTRY: '\u2692', ENERGY: '\u26A1', POPULATION: '\u{1F465}' };

const RESOURCE_LABELS: Record<string, string> = {
  BREAD: 'Bread', GRAIN: 'Grain', ORE: 'Ore', STEEL: 'Steel',
  OIL: 'Oil', POWER: 'Power', TIMBER: 'Timber', LUMBER: 'Lumber',
};

const round1 = (v: number) => Math.round(v);

const POP_CAP: Record<number, number> = CFG.CITY.POPULATION_CAP;
function getPopCap(tier: number): number { return POP_CAP[tier] ?? 50; }

interface StockpileSectionProps {
  city: CityData;
}

export const StockpileSection: FunctionalComponent<StockpileSectionProps> = ({ city }) => {
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
      existing.amount = existing.amount + inflow.amount;
    } else {
      inflowMap[cat].sources.push({ source: inflow.source, amount: inflow.amount });
    }
    inflowMap[cat].total = inflowMap[cat].total + inflow.amount;
  }

  const foodSatPct = Math.round(city.foodPerTick * 100);
  const energySatPct = Math.round(city.energyPerTick * 100);
  const popGrowthRate = city.foodPerTick >= 1.0
    ? CFG.CITY.POPULATION_GROWTH_RATE * city.population * (1 - city.population / getPopCap(city.tier)) * (city.foodPerTick - 1)
    : city.foodPerTick < CFG.CITY.POPULATION_DECLINE_THRESHOLD
      ? -CFG.CITY.POPULATION_DECLINE_RATE * city.population
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
          ? inflow.sources.map(s => `${s.source}: +${s.amount.toFixed(1)}/t`).join('\n')
          : '';
        const inflowLabel = inflow.total > 0 ? ` (+${inflow.total.toFixed(1)}/t)` : '';

        const rows = [
          <div class="panel-row stockpile-category" title={inflowTooltip}>
            <span class="label">{CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}{satLabel}</span>
            <span>{round1(data.total)}{inflowLabel}</span>
          </div>,
        ];
        for (const r of data.resources) {
          rows.push(
            <div class="panel-row stockpile-resource">
              <span class="label resource-indent">{r.label}</span>
              <span>{r.amount}</span>
            </div>
          );
        }
        return rows;
      })}
    </div>
  );
};