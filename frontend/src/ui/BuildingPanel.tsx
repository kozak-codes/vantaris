import { FunctionalComponent } from 'preact';
import type { BuildingData } from '@vantaris/shared';
import {
  myPlayerId, selectedBuildingId,
} from '../state/signals';
import { BUILDING_DISPLAY, RESOURCE_LABELS, EXTRACTOR_OUTPUT, FACTORY_RECIPES } from './hud-shared';
import { sendSetFactoryRecipe } from '../network/ColyseusClient';

interface BuildingPanelProps {
  building: BuildingData;
}

export const BuildingPanel: FunctionalComponent<BuildingPanelProps> = ({ building }) => {
  const isMine = building.ownerId === myPlayerId.value;
  const displayName = BUILDING_DISPLAY[building.type] || building.type;
  const isBuilding = building.productionTicksRemaining > 0;
  const extractorInfo = EXTRACTOR_OUTPUT[building.type];
  const currentRecipe = building.recipe
    ? FACTORY_RECIPES.find(r => r.id === building.recipe)
    : null;

  let productionHtml: any = null;
  if (extractorInfo) {
    const resLabel = RESOURCE_LABELS[extractorInfo.resource] || extractorInfo.resource;
    productionHtml = (
      <div class="panel-section">
        <div class="panel-subtitle">Production</div>
        <div class="panel-row"><span class="label">Output</span><span>+{extractorInfo.amount} {resLabel}/t</span></div>
        <div class="panel-row"><span class="label">Type</span><span>Extractor</span></div>
      </div>
    );
  } else if (building.type === 'FACTORY') {
    if (currentRecipe) {
      const inputLabel = currentRecipe.input.map(i => `${i.amount} ${RESOURCE_LABELS[i.resource] || i.resource}`).join(' + ');
      const outputLabel = currentRecipe.output.map(o => `${o.amount} ${RESOURCE_LABELS[o.resource] || o.resource}`).join(' + ');
      productionHtml = (
        <div class="panel-section">
          <div class="panel-subtitle">Recipe</div>
          <div class="panel-row"><span class="label">{currentRecipe.name}</span><span>{inputLabel} → {outputLabel}</span></div>
          <div class="panel-row"><span class="label">Cycle</span><span>{currentRecipe.ticksPerCycle}t</span></div>
          {building.productionTicksRemaining > 0 && <div class="panel-row"><span class="label">Status</span><span>Under construction ({building.productionTicksRemaining}t)</span></div>}
        </div>
      );
    } else if (!isBuilding) {
      const availableRecipes = FACTORY_RECIPES.filter(r => r.minFactoryTier <= building.factoryTier);
      productionHtml = (
        <div class="panel-section">
          <div class="panel-subtitle">Select Recipe</div>
          {availableRecipes.length > 0
            ? availableRecipes.map(r => {
              const inputLabel = r.input.map(i => `${i.amount} ${RESOURCE_LABELS[i.resource] || i.resource}`).join(' + ');
              const outputLabel = r.output.map(o => `${o.amount} ${RESOURCE_LABELS[o.resource] || o.resource}`).join(' + ');
              return (
                <button class="panel-row panel-row-btn" onClick={() => sendSetFactoryRecipe(building.buildingId, r.id)}>
                  <span class="label">{r.name}</span>
                  <span>{inputLabel} → {outputLabel}</span>
                </button>
              );
            })
            : <div class="panel-row"><span class="label">No recipes available</span></div>
          }
        </div>
      );
    }
  } else if (building.type === 'CITY') {
    productionHtml = (
      <div class="panel-section">
        <div class="panel-subtitle">City Building</div>
        <div class="panel-row"><span class="label">Type</span><span>Settlement</span></div>
      </div>
    );
  }

  let stockpileHtml: any = null;
  if (building.stockpile && building.stockpile.length > 0) {
    stockpileHtml = (
      <div class="panel-section">
        <div class="panel-subtitle">Stockpile</div>
        {building.stockpile.map(entry => (
          <div class="panel-row"><span class="label">{RESOURCE_LABELS[entry.resource] || entry.resource}</span><span>{Math.round(entry.amount)}</span></div>
        ))}
      </div>
    );
  }

  let factoryInfoHtml: any = null;
  if (building.type === 'FACTORY' && !isBuilding) {
    factoryInfoHtml = (
      <div class="panel-section">
        <div class="panel-row"><span class="label">Tier</span><span>Lv.{building.factoryTier}</span></div>
        <div class="panel-row"><span class="label">XP</span><span>{building.factoryXp}</span></div>
        {currentRecipe && isMine && (
          <button class="panel-btn" onClick={() => sendSetFactoryRecipe(building.buildingId, '')}>Clear Recipe</button>
        )}
      </div>
    );
  }

  return (
    <div id="hud-tile-panel" class="panel">
      <div class="panel-header">
        <span class="panel-title">🏗 {displayName}</span>
        <button class="panel-close" onClick={() => { selectedBuildingId.value = null; }}>&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Owner</span><span>{isMine ? 'You' : 'Enemy'}</span></div>
        {isBuilding && <div class="panel-row"><span class="label">Build time</span><span>{building.productionTicksRemaining} ticks</span></div>}
      </div>
      {productionHtml}
      {factoryInfoHtml}
      {stockpileHtml}
      <div class="panel-section panel-back-link">
        <button class="panel-btn panel-btn-secondary" onClick={() => { selectedBuildingId.value = null; }}>← Back</button>
      </div>
    </div>
  );
};