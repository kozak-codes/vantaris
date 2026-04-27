import { FunctionalComponent } from 'preact';
import { CFG, getBuildingCosts, getBuildingPlacementRules, getUnitBuildableTypes } from '@vantaris/shared';
import type { VisibleCellData } from '@vantaris/shared';
import { myPlayerId, unitsOnSelectedTile } from '../state/signals';
import { sendBuildStructure, sendRestoreRuin } from '../network/ColyseusClient';

const BUILDING_COSTS = getBuildingCosts(CFG);
const BUILDING_PLACEMENT_RULES = getBuildingPlacementRules(CFG);

interface BuildMenuProps {
  cellData: VisibleCellData;
  tileId: string;
}

export const BuildMenu: FunctionalComponent<BuildMenuProps> = ({ cellData, tileId }) => {
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