import { FunctionalComponent } from 'preact';
import { CFG } from '@vantaris/shared';
import type { UnitData } from '@vantaris/shared';
import {
  myPlayerId,
  cities, players, unitsOnSelectedTile,
  selectTile, deselectEntity,
} from '../state/signals';
import { BIOME_TRAVEL_NAMES, STATUS_DISPLAY, typeLabel } from './hud-shared';

interface UnitPanelProps {
  unit: UnitData;
  tileId: string;
  biome: string;
  ownerName: string;
  ownerColor: string;
}

function VitalsBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const isLow = pct < 30;
  const barColor = isLow ? '#cc4444' : color;
  return (
    <div class="panel-row">
      <span class="label">{label}</span>
      <div class="vitals-bar-container">
        <div class="vitals-bar-fill" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        <span class="vitals-bar-text">{Math.round(value)}/{max}</span>
      </div>
    </div>
  );
}

export const UnitPanel: FunctionalComponent<UnitPanelProps> = ({ unit, tileId, biome, ownerName, ownerColor }) => {
  const isMyUnit = unit.ownerId === myPlayerId.value;
  const player = players.value.get(unit.ownerId);
  const unitColor = player ? player.color : '#888';
  let statusText = STATUS_DISPLAY[unit.status] || unit.status;
  if (unit.status === 'MOVING' && unit.path && unit.path.length > 0) {
    statusText += ` — ${unit.path.length} tiles to go`;
  } else if (unit.status === 'BUILDING') {
    statusText = `Building — ${unit.buildTicksRemaining} ticks`;
  } else if (unit.status === 'CLAIMING') {
    statusText = `Claiming — ${unit.claimTicksRemaining} ticks`;
  } else if (unit.status === 'RETURNING') {
    statusText = 'Returning home';
  }

  let progressHtml = <></>;
  if (unit.status === 'MOVING') {
    const total = unit.movementTicksTotal || 10;
    const pct = Math.round(((total - unit.movementTicksRemaining) / total) * 100);
    progressHtml = <div class="progress-bar"><div class="progress-fill" style={{ width: `${pct}%` }} /></div>;
  } else if (unit.status === 'CLAIMING') {
    const unitCfg = CFG.UNITS[unit.type];
    const multiplier = unitCfg?.claimTickMultiplier ?? 1;
    const enemyBase = 3000 * multiplier;
    const unclaimedBase = 50 * multiplier;
    const threshold = (enemyBase + unclaimedBase) / 2;
    const maxTicks = unit.claimTicksRemaining > threshold ? enemyBase : unclaimedBase;
    const pct = Math.round(((maxTicks - unit.claimTicksRemaining) / maxTicks) * 100);
    progressHtml = (
      <>
        <div class="progress-bar"><div class="progress-fill claim-fill" style={{ width: `${pct}%` }} /></div>
      </>
    );
  } else if (unit.status === 'BUILDING') {
    progressHtml = <div class="progress-bar"><div class="progress-fill build-fill" style={{ width: '100%' }} /></div>;
  }

  const unitsHere = unitsOnSelectedTile.value;
  const showStack = unitsHere.length > 1;

  const unitConfig = CFG.UNITS[unit.type];
  const maxWeight = unitConfig?.maxWeight ?? 0;

  const vitals = CFG.CITIZEN_VITALS;
  const showVitals = isMyUnit && (unit.type === 'CITIZEN' || unit.type === 'INFANTRY' || unit.type === 'ENGINEER' || unit.type === 'TRADER');

  return (
    <div id="hud-tile-panel" class="panel">
      <div class="panel-header">
        <span class="panel-title" style={{ color: unitColor }}>⦿ {unit.name || typeLabel(unit.type)}</span>
        <button class="panel-close" onClick={() => selectTile(null)}>&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Status</span><span>{statusText}</span></div>
        <div class="panel-row"><span class="label">Owner</span><span style={{ color: ownerColor }}>{ownerName}{isMyUnit ? ' (You)' : ''}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>{BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        {isMyUnit && <div class="panel-row"><span class="label">Credits</span><span>⚡ {Math.round(unit.energyCredits)}</span></div>}
        {isMyUnit && maxWeight > 0 && <div class="panel-row"><span class="label">Carry</span><span>{unit.inventoryWeight}/{maxWeight}</span></div>}
        {showStack && <div class="panel-row"><span class="label">Stack</span><span>{unitsHere.length} units</span></div>}
      </div>
      {showVitals && (
        <div class="panel-section">
          <div class="panel-subtitle">Vitals</div>
          <VitalsBar label="HP" value={unit.health} max={vitals.MAX_HEALTH} color="#44cc44" />
          <VitalsBar label="Hunger" value={unit.hunger} max={vitals.MAX_HUNGER} color="#ccaa44" />
          <VitalsBar label="Rest" value={unit.rest} max={vitals.MAX_REST} color="#4488cc" />
        </div>
      )}
      {progressHtml}
      <div class="panel-section panel-back-link">
        <button class="panel-btn panel-btn-secondary" onClick={() => deselectEntity()}>← Tile info</button>
      </div>
    </div>
  );
};