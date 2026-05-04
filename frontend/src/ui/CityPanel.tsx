import { FunctionalComponent } from 'preact';
import type { CityData } from '@vantaris/shared';
import {
  myPlayerId,
  players, unitsOnSelectedTile, buildingsOnSelectedTile,
  selectTile, selectedBuildingId, deselectEntity,
} from '../state/signals';
import { sendCityToggleCitizenProduction, sendRenameCity } from '../network/ColyseusClient';
import { BIOME_TRAVEL_NAMES, BUILDING_DISPLAY, TIER_NAMES, typeLabel } from './hud-shared';
import { StockpileSection } from './StockpileSection';

interface CityPanelProps {
  city: CityData;
  tileId: string;
  biome: string;
  ownerName: string;
  ownerColor: string;
  isRevealed: boolean;
}

export const CityPanel: FunctionalComponent<CityPanelProps> = ({ city, tileId, biome, ownerName, ownerColor }) => {
  const isMyCity = city.ownerId === myPlayerId.value;
  const tierName = TIER_NAMES[city.tier] || 'Settlement';
  const cityName = city.name || tierName;
  const player = players.value.get(city.ownerId);
  const cityColor = player ? player.color : '#888';
  const maxUnits = city.tier + 1;
  const unitsHere = unitsOnSelectedTile.value.length;
  const xpPct = city.xpToNext > 0 ? Math.min(100, Math.round((city.xp / city.xpToNext) * 100)) : 100;
  const citizenRepeatQueue = city.repeatQueue.filter((t: string) => t === 'CITIZEN');
  const isProducing = citizenRepeatQueue.length > 0;

  let productionHtml = <></>;
  if (city.currentProduction) {
    const pct = city.productionTicksTotal > 0 ? Math.round(((city.productionTicksTotal - city.productionTicksRemaining) / city.productionTicksTotal) * 100) : 0;
    productionHtml = (
      <div class="panel-section">
        <div class="panel-subtitle">Production</div>
        <div class="panel-row"><span class="label">Producing</span><span>{typeLabel(city.currentProduction.type)}</span></div>
        <div class="progress-bar"><div class="progress-fill" style={{ width: `${pct}%` }} /></div>
        <div class="panel-row"><span class="label">Ready in</span><span>{city.productionTicksRemaining} ticks</span></div>
      </div>
    );
  }

  let citizenToggleHtml = <></>;
  if (isMyCity) {
    citizenToggleHtml = (
      <div class="panel-section">
        <div class="panel-subtitle">Production</div>
        <div class="panel-row">
          <span class="label">Recruit {typeLabel('CITIZEN')}</span>
          <button class={`panel-btn toggle-btn${isProducing ? ' toggle-active' : ''}`} onClick={() => sendCityToggleCitizenProduction(city.cityId)}>
            {isProducing ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    );
  }

  const bOnTile = buildingsOnSelectedTile.value;
  let buildingsHtml = <></>;
  if (bOnTile.length > 0) {
    buildingsHtml = (
      <div class="panel-section">
        <div class="panel-subtitle">Buildings</div>
        {bOnTile.map(b => {
          const label = BUILDING_DISPLAY[b.type] || b.type;
          const status = b.productionTicksRemaining > 0 ? ` (${b.productionTicksRemaining}t)` : 'Active';
          return <button class="panel-row panel-row-btn" data-building-id={b.buildingId} onClick={() => { selectedBuildingId.value = b.buildingId; }}><span class="label">{label}</span><span>{status}</span></button>;
        })}
      </div>
    );
  }

  return (
    <div id="hud-tile-panel" class="panel">
      <div class="panel-header">
        <span class="panel-title" style={{ color: cityColor }}>⌂ {cityName}</span>
        <button class="panel-close" onClick={() => selectTile(null)}>&times;</button>
      </div>
      <div class="panel-section">
        {isMyCity && (
          <div class="panel-row">
            <span class="label">Name</span>
            <input class="city-name-input" type="text" value={cityName} maxLength={24}
              onBlur={(e: any) => { const v = e.target.value.trim(); if (v && v !== city.name) sendRenameCity(city.cityId, v); }}
              onKeyDown={(e: any) => { if (e.key === 'Enter') e.target.blur(); }}
            />
          </div>
        )}
        <div class="panel-row"><span class="label">Owner</span><span style={{ color: ownerColor }}>{ownerName}{isMyCity ? ' (You)' : ''}</span></div>
        <div class="panel-row"><span class="label">Tier</span><span>{tierName} (Lv.{city.tier})</span></div>
        <div class="panel-row"><span class="label">Population</span><span>{city.population}</span></div>
        <div class="panel-row"><span class="label">Garrison</span><span>{unitsHere} / {maxUnits}</span></div>
        <div class="panel-row"><span class="label">Homes</span><span>{city.homesAvailable}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>{BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        <div class="panel-row"><span class="label">XP</span><span>{city.xp} / {city.xpToNext}</span></div>
        <div class="progress-bar small"><div class="progress-fill" style={{ width: `${xpPct}%` }} /></div>
      </div>
      <StockpileSection city={city} />
      {productionHtml}
      {citizenToggleHtml}
      {buildingsHtml}
      <div class="panel-section panel-back-link">
        <button class="panel-btn panel-btn-secondary" onClick={() => deselectEntity()}>← Tile info</button>
      </div>
    </div>
  );
};