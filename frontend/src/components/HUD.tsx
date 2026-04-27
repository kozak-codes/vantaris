import { FunctionalComponent } from 'preact';
import { useSignal, useComputed, useSignalEffect } from '@preact/signals';
import { CFG } from '@vantaris/shared';
import {
  selectedCellData, selectedUnit, selectedCity, myPlayerId,
  pendingCommand, unitsOnSelectedTile, buildingsOnSelectedTile,
  selectUnit, selectCity, selectTile, resources, players,
  chatMessages, eliminationReason, myColor, phase,
} from '../state/signals';
import { StockpileSection, BuildMenu } from './panels';

const BIOME_TRAVEL_NAMES: Record<string, string> = {
  PLAINS: 'Plains', FOREST: 'Forest', MOUNTAIN: 'Mountain',
  DESERT: 'Desert', TUNDRA: 'Tundra', OCEAN: 'Ocean', PENTAGON: 'Pentagon',
};

const STATUS_DISPLAY: Record<string, string> = {
  IDLE: 'Idle', MOVING: 'Moving', BUILDING: 'Building', CLAIMING: 'Claiming',
};

export const HUD: FunctionalComponent = () => {
  const cellData = selectedCellData.value;
  const unit = selectedUnit.value;
  const city = selectedCity.value;

  if (!cellData && !unit && !city) {
    return <div id="hud" class="hidden" />;
  }

  const owner = cellData?.ownerId;
  const ownerPlayer = owner ? players.value.get(owner) : null;
  const ownerName = ownerPlayer ? ownerPlayer.displayName : (owner ? 'Unknown' : 'Unclaimed');
  const ownerColor = ownerPlayer ? ownerPlayer.color : '#888';
  const biome = cellData?.biome ?? '???';
  const isMyCity = city && city.ownerId === myPlayerId.value;

  return (
    <div id="hud">
      {unit && <UnitPanel unit={unit} cellData={cellData} biome={biome} ownerName={ownerName} ownerColor={ownerColor} />}
      {city && !unit && <CityPanel city={city} cellData={cellData} biome={biome} ownerName={ownerName} ownerColor={ownerColor} isMyCity={!!isMyCity} />}
      {!unit && !city && cellData && <TilePanel cellData={cellData} biome={biome} ownerName={ownerName} ownerColor={ownerColor} />}
    </div>
  );
};

interface UnitPanelProps {
  unit: any;
  cellData: any;
  biome: string;
  ownerName: string;
  ownerColor: string;
}

const UnitPanel: FunctionalComponent<UnitPanelProps> = ({ unit, cellData, biome, ownerName, ownerColor }) => {
  const isMyUnit = unit.ownerId === myPlayerId.value;
  const typeLabel = unit.type === 'ENGINEER' ? 'Engineer' : unit.type === 'INFANTRY' ? 'Infantry' : unit.type;

  let statusText = STATUS_DISPLAY[unit.status] || unit.status;
  if (unit.status === 'BUILDING') statusText = `Building — ${unit.buildTicksRemaining} ticks`;
  else if (unit.status === 'MOVING' && unit.path?.length > 0) statusText += ` — ${unit.path.length} tiles`;

  const canClaim = isMyUnit && unit.type === 'INFANTRY' && unit.status === 'IDLE' && cellData && cellData.ownerId !== myPlayerId.value;

  return (
    <div id="tile-panel" class="tile-panel">
      <div class="panel-header">
        <span class="panel-title">✦ {typeLabel}</span>
        <button class="panel-close" onClick={() => selectTile(null)}>&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Status</span><span id="panel-dynamic-status">{statusText}</span></div>
        <div class="panel-row"><span class="label">Owner</span><span style={{ color: ownerColor }}>{ownerName}{isMyUnit ? ' (You)' : ''}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>{BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
      </div>
      {canClaim && (
        <div class="panel-section">
          <button class="panel-btn cmd-btn" onClick={() => {
            (window as any).__vantaris_sendClaimTerritory?.(unit.unitId, unit.cellId);
          }}>2 Claim<span class="cmd-key">2</span></button>
        </div>
      )}
      {isMyUnit && unit.status === 'IDLE' && cellData && <BuildMenu cellData={cellData} tileId={unit.cellId} />}
    </div>
  );
};

interface CityPanelProps {
  city: any;
  cellData: any;
  biome: string;
  ownerName: string;
  ownerColor: string;
  isMyCity: boolean;
}

const CityPanel: FunctionalComponent<CityPanelProps> = ({ city, cellData, biome, ownerName, ownerColor, isMyCity }) => {
  const tierName = `T${city.tier} City`;
  const maxUnits = city.tier + 1;
  const unitsHere = unitsOnSelectedTile.value.length;
  const xpPct = city.xpToNext > 0 ? Math.min(100, Math.round((city.xp / city.xpToNext) * 100)) : 100;
  const cityColor = isMyCity ? myColor.value : ownerColor;

  return (
    <div id="tile-panel" class="tile-panel">
      <div class="panel-header">
        <span class="panel-title" style={{ color: cityColor }}>⌂ {tierName}</span>
        <button class="panel-close" onClick={() => selectTile(null)}>&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Owner</span><span style={{ color: ownerColor }}>{ownerName}{isMyCity ? ' (You)' : ''}</span></div>
        <div class="panel-row"><span class="label">Tier</span><span>{tierName} (Lv.{city.tier})</span></div>
        <div class="panel-row"><span class="label">Population</span><span id="panel-dynamic-pop">{city.population}</span></div>
        <div class="panel-row"><span class="label">Garrison</span><span>{unitsHere} / {maxUnits}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>{BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        <div class="panel-row"><span class="label">XP</span><span id="panel-dynamic-xp-text">{city.xp} / {city.xpToNext}</span></div>
        <div class="progress-bar small"><div class="progress-fill" id="panel-dynamic-xp-fill" style={{ width: `${xpPct}%` }} /></div>
      </div>
      <StockpileSection city={city} />
      {cellData && isMyCity && <BuildMenu cellData={cellData} tileId={city.cellId} />}
    </div>
  );
};

interface TilePanelProps {
  cellData: any;
  biome: string;
  ownerName: string;
  ownerColor: string;
}

const TilePanel: FunctionalComponent<TilePanelProps> = ({ cellData, biome, ownerName, ownerColor }) => {
  return (
    <div id="tile-panel" class="tile-panel">
      <div class="panel-header">
        <span class="panel-title">▣ {BIOME_TRAVEL_NAMES[biome] || biome}</span>
        <button class="panel-close" onClick={() => selectTile(null)}>&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Owner</span><span style={{ color: ownerColor }}>{ownerName}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>{BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
      </div>
    </div>
  );
};

export const ResourceBar: FunctionalComponent = () => {
  const r = resources.value;
  return (
    <div id="resource-bar" class="resource-bar">
      <div class="res-item"><span class="res-icon food-icon">☘</span><span class="res-val">{r.food}</span><span class="res-rate">+{r.foodPerTick}/t</span></div>
      <div class="res-item"><span class="res-icon energy-icon">⚡</span><span class="res-val">{r.energy}</span><span class="res-rate">+{r.energyPerTick}/t</span></div>
      <div class="res-sep"></div>
      <div class="res-item"><span class="res-icon pop-icon">⚑</span><span class="res-val">{r.totalPopulation}</span></div>
      <div class="res-item"><span class="res-icon factory-icon">⚙</span><span class="res-val">{r.factoryCount}</span></div>
    </div>
  );
};