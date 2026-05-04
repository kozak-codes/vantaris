import { FunctionalComponent } from 'preact';
import { CFG, type BuildingData } from '@vantaris/shared';
import {
  myPlayerId, selectedBuildingId,
} from '../state/signals';
import { BUILDING_DISPLAY, RESOURCE_LABELS, EXTRACTOR_OUTPUT, FACTORY_RECIPES } from './hud-shared';
import { sendSetFactoryRecipe, sendSetStockpileTarget } from '../network/ColyseusClient';

// Strip delivery target imports, add stockpile target
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
  const bldgConfig = CFG.BUILDINGS[building.type];
  const wagePer100 = bldgConfig?.wagePer100Ticks ?? 0;
  const defaultTarget = bldgConfig?.target ?? 0;
  const currentTarget = building.stockpileTarget || defaultTarget;

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
    const specCycles = building.specializationCycles || 0;
    const specMultiplier = 1 + specCycles * CFG.FACTORY.SPECIALIZATION_BONUS_PER_CYCLE;
    const specPercent = Math.round((specMultiplier - 1) * 100);
    const effectiveTicks = Math.ceil(currentRecipe.ticksPerCycle / specMultiplier);
    const cycleDisplay = specCycles > 0 ? `${effectiveTicks}t (base ${currentRecipe.ticksPerCycle}t)` : `${currentRecipe.ticksPerCycle}t`;
    const recipeTotal = building.recipeTicksTotal || effectiveTicks;
    const recipeRemaining = building.recipeTicksRemaining || 0;
    const recipeProgress = recipeTotal > 0 ? Math.round(((recipeTotal - recipeRemaining) / recipeTotal) * 100) : 0;
      productionHtml = (
        <div class="panel-section">
          <div class="panel-subtitle">Recipe</div>
          <div class="panel-row"><span class="label">{currentRecipe.name}</span><span>{inputLabel} → {outputLabel}</span></div>
          <div class="panel-row"><span class="label">Cycle</span><span>{cycleDisplay}</span></div>
          {building.recipeTicksRemaining > 0 && (
            <div class="progress-bar-container">
              <div class="progress-bar" style={{ width: `${recipeProgress}%` }} />
              <span class="progress-bar-label">{recipeRemaining}t</span>
            </div>
          )}
          {isMine && (
            <button class="panel-btn" style={{ marginTop: '4px' }} onClick={() => sendSetFactoryRecipe(building.buildingId, '')}>Clear Recipe</button>
          )}
        </div>
      );
    } else {
      const availableRecipes = FACTORY_RECIPES.filter(r => r.minFactoryTier <= building.factoryTier);
      productionHtml = (
        <div class="panel-section">
          <div class="panel-subtitle">{isBuilding ? 'Select Recipe (activates when built)' : 'Select Recipe'}</div>
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
  const totalStock = building.stockpile.reduce((sum, e) => sum + e.amount, 0);
  if (building.stockpile && building.stockpile.length > 0) {
    stockpileHtml = (
      <div class="panel-section">
        <div class="panel-subtitle">Stockpile ({Math.round(totalStock)}/{currentTarget})</div>
        {building.stockpile.map(entry => (
          <div class="panel-row"><span class="label">{RESOURCE_LABELS[entry.resource] || entry.resource}</span><span>{Math.round(entry.amount)}</span></div>
        ))}
      </div>
    );
  }

  let targetHtml: any = null;
  if (isMine && defaultTarget > 0) {
    targetHtml = (
      <div class="panel-section">
        <div class="panel-row"><span class="label">Target</span><span class="economy-setting">
          <input type="number" class="economy-input" value={currentTarget} min={0} step={10}
            onInput={(e: any) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) sendSetStockpileTarget(building.buildingId, v); }}
          />
          <span class="economy-unit">stock</span>
        </span></div>
        {wagePer100 > 0 && <div class="panel-row"><span class="label">Wage</span><span>⚡ {wagePer100}/100t</span></div>}
      </div>
    );
  }

  let factoryInfoHtml: any = null;
  if (building.type === 'FACTORY') {
    const specCycles = building.specializationCycles || 0;
    const specMultiplier = 1 + specCycles * CFG.FACTORY.SPECIALIZATION_BONUS_PER_CYCLE;
    const specPercent = Math.round((specMultiplier - 1) * 100);
    factoryInfoHtml = (
      <div class="panel-section">
        <div class="panel-row"><span class="label">Tier</span><span>Lv.{building.factoryTier}</span></div>
        <div class="panel-row"><span class="label">XP</span><span>{building.factoryXp}</span></div>
        {currentRecipe && specCycles > 0 && (
          <div class="panel-row"><span class="label">Specialization</span><span>+{specPercent}% speed ({specCycles} cycles)</span></div>
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
      {targetHtml}
      {factoryInfoHtml}
      {stockpileHtml}
      <div class="panel-section panel-back-link">
        <button class="panel-btn panel-btn-secondary" onClick={() => { selectedBuildingId.value = null; }}>← Back</button>
      </div>
    </div>
  );
};