import { FunctionalComponent } from 'preact';
import { CFG, getBuildingCosts, getBuildingPlacementRules, getUnitBuildableTypes } from '@vantaris/shared';
import type { VisibleCellData } from '@vantaris/shared';
import { myPlayerId, unitsOnSelectedTile } from '../state/signals';
import { sendBuildStructure } from '../network/ColyseusClient';
import { BUILDING_DISPLAY } from './hud-shared';

const BUILDING_COSTS = getBuildingCosts(CFG);
const BUILDING_PLACEMENT_RULES = getBuildingPlacementRules(CFG);

interface BuildMenuProps {
  cellData: VisibleCellData;
  tileId: string;
}

export const BuildMenu: FunctionalComponent<BuildMenuProps> = ({ cellData, tileId }) => {
  if (!cellData || cellData.ownerId !== myPlayerId.value) return null;

  const idleUnit = unitsOnSelectedTile.value.find(u => u.ownerId === myPlayerId.value && u.status === 'IDLE');
  if (!idleUnit) return null;

  const canBuild = getUnitBuildableTypes(CFG, idleUnit.type, idleUnit.type === 'ENGINEER' ? (idleUnit as any).engineerLevel ?? 1 : 1);
  const buildOptions: { type: string; label: string; cost: string }[] = [];

  for (const bt of canBuild) {
    const allowedBiomes = BUILDING_PLACEMENT_RULES[bt];
    if (allowedBiomes && !allowedBiomes.includes(cellData.biome)) continue;
    if (bt === 'CITY' && cellData.buildings.some((b: any) => b.type === 'CITY')) continue;
    const cost = BUILDING_COSTS[bt];
    if (!cost) continue;
    const label = BUILDING_DISPLAY[bt] || bt;
    buildOptions.push({ type: bt, label, cost: `F:${cost.food} M:${cost.material}` });
  }

  if (buildOptions.length === 0) return null;

  return (
    <div class="panel-section">
      <div class="panel-subtitle">Build</div>
      {buildOptions.map(o => (
        <button class="panel-btn cmd-btn" onClick={() => sendBuildStructure(idleUnit.unitId, tileId, o.type)}>
          {o.label} <span class="build-option-cost">{o.cost}</span>
        </button>
      ))}
    </div>
  );
};