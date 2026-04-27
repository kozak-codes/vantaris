import { FunctionalComponent } from 'preact';
import {
  myPlayerId, visibleCells, units, cities, buildings, players,
  selectTile, selectUnit, selectCity, selectedBuildingId,
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

  let cityOnTile: { cityId: string; name: string; tier: number; producing: boolean; isMyCity: boolean } | null = null;
  for (const [cityId, city] of cities.value) {
    if (city.cellId === tileId) {
      cityOnTile = { cityId, name: city.name, tier: city.tier, producing: city.repeatQueue.length > 0 || city.currentProduction !== null, isMyCity: city.ownerId === myPlayerId.value };
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

  return (
    <div id="hud-tile-panel" class="panel">
      <div class="panel-header">
        <span class="panel-title">{isRevealed ? '⚠ Revealed' : (BIOME_TRAVEL_NAMES[biome] || biome)}</span>
        <button class="panel-close" onClick={() => selectTile(null)}>&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Owner</span><span style={ownerColor !== '#888' ? { color: ownerColor } : {}}>{ownerName}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>{BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        <div class="panel-row"><span class="label">Units</span><span>{unitsOnTile.length}</span></div>
      </div>
      {cityOnTile && (
        <div class="panel-section">
          <div class="panel-subtitle">City</div>
          <button class="panel-row panel-row-btn" onClick={() => selectCity(cityOnTile!.cityId)}>
            <span class="label">{cityOnTile.name || TIER_NAMES[cityOnTile.tier] || 'Settlement'}</span>
            {cityOnTile.isMyCity && <span class="owned-label">Yours</span>}
          </button>
        </div>
      )}
      {bOnTile.length > 0 && (
        <div class="panel-section">
          <div class="panel-subtitle">Structures</div>
          {bOnTile.map(b => (
            <button class="panel-row panel-row-btn" data-building-id={b.buildingId} onClick={() => { selectedBuildingId.value = b.buildingId; }}>
              <span>{BUILDING_DISPLAY[b.type] || b.type}</span>
              {b.isMine && <span class="label owned-label">Yours</span>}
            </button>
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