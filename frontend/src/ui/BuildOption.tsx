import { FunctionalComponent } from 'preact';
import { BUILDING_COSTS, BUILDING_TICKS, BUILDING_DISPLAY, RESOURCE_LABELS } from './hud-shared';

interface BuildOptionProps {
  name: string;
  costParts: { label: string; amount: number; affordable: boolean }[];
  ticksLabel?: string;
  affordable: boolean;
  onClick: () => void;
}

export const BuildOption: FunctionalComponent<BuildOptionProps> = ({ name, costParts, ticksLabel, affordable, onClick }) => {
  const costHtml = costParts.length === 0
    ? '<span class="build-option-cost">Free</span>'
    : costParts.map(p => `<span class="${p.affordable ? '' : 'resource-missing'}">${p.label} ${p.amount}</span>`).join(' ');

  const dimClass = affordable ? '' : ' build-option-dimmed';
  const ticksHtml = ticksLabel ? `<span class="build-option-ticks">${ticksLabel}</span>` : '';

  return (
    <button
      class={`build-option${dimClass}`}
      onClick={affordable ? onClick : undefined}
      disabled={!affordable}
      dangerouslySetInnerHTML={{
        __html: `<span class="build-option-name">${name}</span>${costHtml}${ticksHtml}`
      }}
    />
  );
};

export function formatBuildingCost(buildingType: string, cellData: any, cityStockpile: Map<string, number> | null): {
  name: string;
  costParts: { label: string; amount: number; affordable: boolean }[];
  ticksLabel: string;
  affordable: boolean;
  exhaustionCost: number;
} {
  const cost = BUILDING_COSTS[buildingType];
  const name = BUILDING_DISPLAY[buildingType] || buildingType;
  const foodCost = cost?.food ?? 0;
  const materialCost = cost?.material ?? 0;
  const exhaustionCost = cost?.exhaustionCost ?? 1;

  const costParts: { label: string; amount: number; affordable: boolean }[] = [];
  let affordable = true;

  if (foodCost > 0) {
    const hasFood = cityStockpile ? canAffordResource(cityStockpile, 'FOOD', foodCost) : true;
    costParts.push({ label: RESOURCE_LABELS['FOOD'] || 'Food', amount: foodCost, affordable: hasFood });
    if (!hasFood) affordable = false;
  }
  if (materialCost > 0) {
    const hasMat = cityStockpile ? canAffordMaterial(cityStockpile, materialCost) : true;
    costParts.push({ label: RESOURCE_LABELS['MATERIAL'] || 'Mat', amount: materialCost, affordable: hasMat });
    if (!hasMat) affordable = false;
  }

  const ticksLabel = BUILDING_TICKS[buildingType] ? `${BUILDING_TICKS[buildingType]}t` : '';

  return { name, costParts, ticksLabel, affordable, exhaustionCost };
}

export function formatUpgradeCost(upgradeCost: Record<string, number>, cityStockpile: Map<string, number> | null): {
  costParts: { label: string; amount: number; affordable: boolean }[];
  affordable: boolean;
} {
  const costParts: { label: string; amount: number; affordable: boolean }[] = [];
  let affordable = true;

  for (const [resource, amount] of Object.entries(upgradeCost)) {
    if (amount <= 0) continue;
    const label = RESOURCE_LABELS[resource] || resource;
    const hasResource = cityStockpile ? canAffordResource(cityStockpile, resource, amount) : true;
    costParts.push({ label, amount, affordable: hasResource });
    if (!hasResource) affordable = false;
  }

  return { costParts, affordable };
}

function canAffordResource(stockpile: Map<string, number>, resource: string, amount: number): boolean {
  const direct = stockpile.get(resource) ?? 0;
  if (direct >= amount) return true;
  return false;
}

function canAffordMaterial(stockpile: Map<string, number>, amount: number): boolean {
  const ore = stockpile.get('ORE') ?? 0;
  const steel = stockpile.get('STEEL') ?? 0;
  const timber = stockpile.get('TIMBER') ?? 0;
  const lumber = stockpile.get('LUMBER') ?? 0;
  return (ore * 1.0 + steel * 1.5 + timber * 0.5 + lumber * 0.75) >= amount;
}