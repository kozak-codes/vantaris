import { FunctionalComponent } from 'preact';
import {
  myPlayerId, visibleCells, units, cities, buildings, players,
  selectTile, selectUnit, selectCity,
} from '../state/signals';
import { BIOME_TRAVEL_NAMES, BUILDING_DISPLAY, TIER_NAMES, STATUS_DISPLAY } from './hud-shared';

interface TilePanelProps {
  tileId: string;
  biome: string;
  ownerName: string;
  ownerColor: string;
  isRevealed: boolean;
}

export const TilePanel: FunctionalComponent<TilePanelProps> = ({ tileId, biome, ownerName, ownerColor, isRevealed }) => {
  const unitsOnTile: { unitId: string; type: string; status: string; isMyUnit: boolean; color: string }[] = [];
  for (const [uid, u] of units.value) {
    if (u.cellId === tileId) {
      const isMyUnit = u.ownerId === myPlayerId.value;
      const p = players.value.get(u.ownerId);
      const color = p ? p.color : '#888';
      unitsOnTile.push({ unitId: uid, type: u.type, status: u.status, isMyUnit, color });
    }
  }

  let cityOnTile: { cityId: string; tier: number; producing: boolean; isMyCity: boolean } | null = null;
  for (const [cityId, city] of cities.value) {
    if (city.cellId === tileId) {
      cityOnTile = { cityId, tier: city.tier, producing: city.repeatQueue.length > 0 || city.currentProduction !== null, isMyCity: city.ownerId === myPlayerId.value };
      break;
    }
  }

  const bOnTile: { buildingId: string; type: string; isMine: boolean }[] = [];
  for (const [buildingId, b] of buildings.value) {
    if (b.cellId === tileId) {
      bOnTile.push({ buildingId, type: b.type, isMine: b.ownerId === myPlayerId.value });
    }
  }

  const cellData = visibleCells.value.get(tileId);
  let resourceHtml = <></>;
  if (cellData && cellData.resourceYield && cellData.resourceYield.primary !== 'NONE') {
    const label = /* use RESOURCE_LABELS */ cellData.resourceYield.primary;
    resourceHtml = <div class="panel-row"><span class="label">Resource</span><span>{label} +{cellData.resourceYield.amount}</span></div>;
  }

  return (
    <div id="hud-tile-panel" class="panel">
      <div class="panel-header">
        <span class="panel-title">{isRevealed ? '⚠ Revealed' : (BIOME_TRAVEL_NAMES[biome] || biome)}</span>
        <button class="panel-close" onClick={() => selectTile(null)}>&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Owner</span><span style={ownerColor !== '#888' ? { color: ownerColor } : {}}>{ownerName}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>{BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        {resourceHtml}
        <div class="panel-row"><span class="label">Units</span><span>{unitsOnTile.length}</span></div>
      </div>
      {cityOnTile && (
        <div class="panel-section">
          <div class="panel-subtitle">Building</div>
          <div class="panel-row" onClick={() => selectCity(cityOnTile!.cityId)}>
            <span>{TIER_NAMES[cityOnTile.tier] || 'Settlement'}</span>
            {cityOnTile.isMyCity && <span class="label owned-label">Yours</span>}
          </div>
        </div>
      )}
      {bOnTile.length > 0 && (
        <div class="panel-section">
          <div class="panel-subtitle">Structures</div>
          {bOnTile.map(b => (
            <div class="panel-row">
              <span>{BUILDING_DISPLAY[b.type] || b.type}</span>
              {b.isMine && <span class="label owned-label">Yours</span>}
            </div>
          ))}
        </div>
      )}
      {unitsOnTile.length > 0 && (
        <div class="panel-section">
          <div class="panel-subtitle">Units</div>
          {unitsOnTile.map(u => {
            const statusText = u.status !== 'IDLE' ? ` — ${STATUS_DISPLAY[u.status] || u.status}` : '';
            return (
              <div class="panel-row unit-row my-unit" onClick={() => selectUnit(u.unitId)}>
                <span class="unit-icon" style={{ background: u.color }}></span>
                <span>{u.type}{statusText}</span>
                {u.isMyUnit && <span class="label owned-label">Yours</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};