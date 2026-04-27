import { FunctionalComponent } from 'preact';
import { CFG, getBuildingCosts, getBuildingPlacementRules, getUnitBuildableTypes } from '@vantaris/shared';
import type { UnitData } from '@vantaris/shared';
import {
  myPlayerId, pendingCommand, selectedUnitId, selectedCityId,
  visibleCells, cities, players, unitsOnSelectedTile,
  selectTile,
} from '../state/signals';
import { sendClaimTerritory, sendSetUnitIdle, sendBuildStructure, sendRestoreRuin } from '../network/ColyseusClient';
import { BIOME_TRAVEL_NAMES, STATUS_DISPLAY, BUILDING_DISPLAY, typeLabel } from './hud-shared';
import { BuildMenu } from './BuildMenu';

const BUILDING_COSTS = getBuildingCosts(CFG);
const BUILDING_PLACEMENT_RULES = getBuildingPlacementRules(CFG);

interface UnitPanelProps {
  unit: UnitData;
  tileId: string;
  biome: string;
  ownerName: string;
  ownerColor: string;
  isRevealed: boolean;
}

export const UnitPanel: FunctionalComponent<UnitPanelProps> = ({ unit, tileId, biome, ownerName, ownerColor }) => {
  const isMyUnit = unit.ownerId === myPlayerId.value;
  const player = players.value.get(unit.ownerId);
  const unitColor = player ? player.color : '#888';
  const cmd = pendingCommand.value;

  let statusText = STATUS_DISPLAY[unit.status] || unit.status;
  if (unit.status === 'MOVING' && unit.path && unit.path.length > 0) {
    statusText += ` — ${unit.path.length} tiles to go`;
  } else if (unit.status === 'BUILDING') {
    statusText = `Building — ${unit.buildTicksRemaining} ticks`;
  }

  let progressHtml = <></>;
  if (unit.status === 'MOVING') {
    const total = unit.movementTicksTotal || 10;
    const pct = Math.round(((total - unit.movementTicksRemaining) / total) * 100);
    progressHtml = <div class="progress-bar"><div class="progress-fill" style={{ width: `${pct}%` }} /></div>;
  } else if (unit.status === 'CLAIMING') {
    const maxTicks = unit.claimTicksRemaining > 100 ? 300 : 50;
    const pct = Math.round(((maxTicks - unit.claimTicksRemaining) / maxTicks) * 100);
    progressHtml = (
      <>
        <div class="progress-bar"><div class="progress-fill claim-fill" style={{ width: `${pct}%` }} /></div>
        <div class="panel-row"><span class="label">Claiming</span><span>{unit.claimTicksRemaining} ticks</span></div>
      </>
    );
  } else if (unit.status === 'BUILDING') {
    progressHtml = <div class="progress-bar"><div class="progress-fill build-fill" style={{ width: '100%' }} /></div>;
  }

  let commandsHtml = <></>;
  if (isMyUnit && unit.status === 'IDLE') {
    const cellData = visibleCells.value.get(unit.cellId);
    const alreadyOwnsTile = cellData && cellData.ownerId === myPlayerId.value;
    const moveActive = cmd === 'move' ? ' active' : '';

    const canClaim = !alreadyOwnsTile && unit.type === 'INFANTRY';
    const claimButton = canClaim
      ? <button class="panel-btn cmd-btn" onClick={() => { sendClaimTerritory(unit.unitId); pendingCommand.value = null; }} title="Claim the tile this unit is standing on">2 Claim<span class="cmd-key">2</span></button>
      : <></>;

    let buildButton = <></>;
    if (cellData && cellData.ownerId === myPlayerId.value) {
      if (cellData.ruin && cellData.ruinRevealed) {
        buildButton = <button class="panel-btn cmd-btn" onClick={() => { sendRestoreRuin(unit.unitId, unit.cellId); pendingCommand.value = null; }} title="Restore this ruin">3 Restore<span class="cmd-key">3</span></button>;
      } else {
        const canBuildTypes = unit.type === 'ENGINEER'
          ? getUnitBuildableTypes(CFG, 'ENGINEER', (unit as any).engineerLevel ?? 1)
          : getUnitBuildableTypes(CFG, 'INFANTRY', 1);
        const placeableTypes = canBuildTypes.filter((bt: string) => {
          const allowedBiomes = BUILDING_PLACEMENT_RULES[bt];
          if (allowedBiomes && !allowedBiomes.includes(cellData.biome)) return false;
          if (bt === 'CITY') {
            let cellHasCity = false;
            for (const [, c] of cities.value) { if (c.cellId === unit.cellId) { cellHasCity = true; break; } }
            return !cellHasCity;
          }
          return cellData.buildings.length < cellData.buildingCapacity;
        });
        if (placeableTypes.length > 0) {
          buildButton = <button class="panel-btn cmd-btn" onClick={() => {
            const freeExtractor = placeableTypes.find((bt: string) => {
              const cost = BUILDING_COSTS[bt];
              return cost && cost.food === 0 && cost.material === 0;
            });
            if (freeExtractor) {
              sendBuildStructure(unit.unitId, freeExtractor, unit.cellId);
              pendingCommand.value = null;
            }
          }} title="Build a structure on this hex">3 Build<span class="cmd-key">3</span></button>;
        }
      }
    }

    commandsHtml = (
      <div class="panel-actions">
        <button class={`panel-btn cmd-btn${moveActive}`} onClick={() => { pendingCommand.value = cmd === 'move' ? null : 'move'; }} title="Click a destination tile to move there">1 Move<span class="cmd-key">1</span></button>
        {claimButton}
        {buildButton}
        <button class="panel-btn" onClick={() => { sendSetUnitIdle(unit.unitId); pendingCommand.value = null; }} title="Stop unit / cancel">Stop</button>
      </div>
    );
    if (cmd === 'move') {
      commandsHtml = (
        <>
          {commandsHtml}
          <div class="cmd-hint">Click a tile to move there</div>
        </>
      );
    }
  } else if (isMyUnit && unit.status !== 'IDLE') {
    commandsHtml = (
      <div class="panel-actions">
        <button class="panel-btn" onClick={() => sendSetUnitIdle(unit.unitId)}>Halt</button>
      </div>
    );
  }

  const unitsHere = unitsOnSelectedTile.value;
  const showStack = unitsHere.length > 1;

  let buildOptionsHtml: any[] = [];
  if (isMyUnit && unit.status === 'IDLE') {
    const cellData = visibleCells.value.get(unit.cellId);
    if (cellData && cellData.ownerId === myPlayerId.value && !(unit.type === 'ENGINEER' && cellData.ruin && cellData.ruinRevealed)) {
      const canBuildTypes = unit.type === 'ENGINEER'
        ? getUnitBuildableTypes(CFG, 'ENGINEER', (unit as any).engineerLevel ?? 1)
        : getUnitBuildableTypes(CFG, 'INFANTRY', 1);
      const allBuildable = unit.type === 'ENGINEER'
        ? ['FARM', 'MINE', 'OIL_WELL', 'LUMBER_CAMP', 'FACTORY', 'CITY']
        : getUnitBuildableTypes(CFG, 'INFANTRY', 1);

      for (const bt of allBuildable) {
        const allowedBiomes = BUILDING_PLACEMENT_RULES[bt];
        const biomeOk = !allowedBiomes || allowedBiomes.includes(cellData.biome);
        const canBuildByLevel = canBuildTypes.includes(bt);
        let capacityOk = false;
        if (bt === 'CITY') {
          let cellHasCity = false;
          for (const [, c] of cities.value) { if (c.cellId === unit.cellId) { cellHasCity = true; break; } }
          capacityOk = !cellHasCity;
        } else {
          capacityOk = cellData.buildings.length < cellData.buildingCapacity;
        }
        if (!(canBuildByLevel && biomeOk && capacityOk)) continue;

        const cost = BUILDING_COSTS[bt];
        const isFree = !cost || (cost.food === 0 && cost.material === 0);
        let costLabel = 'Free';
        if (cost && (cost.food > 0 || cost.material > 0)) {
          const parts: string[] = [];
          if (cost.food > 0) parts.push(`\u{1F33E} ${cost.food}`);
          if (cost.material > 0) parts.push(`\u{1FAA8} ${cost.material}`);
          costLabel = parts.join(' ');
        }
        const consumesNote = cost?.consumesBuilder ? ' \u26A0 Consumes unit' : '';
        const displayName = BUILDING_DISPLAY[bt] || bt;

        buildOptionsHtml.push(
          <div class="build-option" onClick={() => { sendBuildStructure(unit.unitId, bt, unit.cellId); pendingCommand.value = null; }} title={`${costLabel}${consumesNote}`}>
            <span class="build-option-name">{displayName}</span>
            <span class="build-option-cost">{isFree ? '\u2713 Free' : costLabel}{consumesNote}</span>
          </div>
        );
      }
    }
  }

  const cellDataForMenu = visibleCells.value.get(unit.cellId);

  return (
    <div id="hud-tile-panel" class="panel">
      <div class="panel-header">
        <span class="panel-title" style={{ color: unitColor }}>⦿ {typeLabel(unit.type)}</span>
        <button class="panel-close" onClick={() => selectTile(null)}>&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Status</span><span>{statusText}</span></div>
        <div class="panel-row"><span class="label">Owner</span><span style={{ color: ownerColor }}>{ownerName}{isMyUnit ? ' (You)' : ''}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>{BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        {showStack && <div class="panel-row"><span class="label">Stack</span><span>{unitsHere.length} units</span></div>}
      </div>
      {progressHtml}
      {commandsHtml}
      {buildOptionsHtml.length > 0 && (
        <div class="panel-section">
          <div class="panel-subtitle">Build Options</div>
          {buildOptionsHtml}
        </div>
      )}
      {cellDataForMenu && <BuildMenu cellData={cellDataForMenu} tileId={unit.cellId} />}
      <div class="panel-section panel-back-link">
        <button class="panel-btn panel-btn-secondary" onClick={() => { selectedUnitId.value = null; selectedCityId.value = null; pendingCommand.value = null; }}>← Tile info</button>
      </div>
    </div>
  );
};