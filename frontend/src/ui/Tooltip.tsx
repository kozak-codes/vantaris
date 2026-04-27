import { FunctionalComponent } from 'preact';
import { hoveredCellId, mouseClientX, mouseClientY, hoveredCellData, hoveredRevealedData, players, ruinMarkers } from '../state/signals';
import { BIOME_TRAVEL_NAMES, BUILDING_DISPLAY, RUIN_LABELS, RESOURCE_LABELS } from './hud-shared';

export const Tooltip: FunctionalComponent = () => {
  const hoveredId = hoveredCellId.value;
  if (!hoveredId) return <div id="hud-tooltip" class="hidden" />;

  const cellData = hoveredCellData.value;
  const revealedData = hoveredRevealedData.value;
  if (!cellData && !revealedData) return <div id="hud-tooltip" class="hidden" />;

  const tx = Math.min(mouseClientX.value + 16, window.innerWidth - 180);
  const ty = Math.min(mouseClientY.value + 16, window.innerHeight - 80);

  const biome = cellData ? cellData.biome : (revealedData ? revealedData.lastKnownBiome : '???');
  const biomeText = BIOME_TRAVEL_NAMES[biome] || biome || '???';
  const fog = cellData ? 'VISIBLE' : 'REVEALED';
  const fogLabel = fog === 'VISIBLE' ? 'Visible' : 'Revealed';

  const owner = cellData ? cellData.ownerId : (revealedData ? revealedData.lastKnownOwnerId : '');
  const ownerPlayer = owner ? players.value.get(owner) : null;
  const ownerName = ownerPlayer ? ownerPlayer.displayName : (owner ? 'Unknown' : 'Unclaimed');
  const ownerColor = ownerPlayer ? ownerPlayer.color : '#888';

  let ruinText = '';
  if (cellData && cellData.ruin && cellData.ruinRevealed) {
    ruinText = RUIN_LABELS[cellData.ruin] || cellData.ruin;
  } else if (cellData && cellData.ruin && !cellData.ruinRevealed) {
    ruinText = 'Ruin (unexplored)';
  } else if (revealedData && revealedData.lastKnownRuin) {
    ruinText = RUIN_LABELS[revealedData.lastKnownRuin] || revealedData.lastKnownRuin;
  } else if (ruinMarkers.value.has(hoveredId)) {
    ruinText = 'Ruin detected';
  }

  let resourceText = '';
  if (cellData && cellData.resourceYield && cellData.resourceYield.primary !== 'NONE') {
    const label = RESOURCE_LABELS[cellData.resourceYield.primary] || cellData.resourceYield.primary;
    resourceText = `${label} +${cellData.resourceYield.amount}`;
  }

  let buildingParts: string[] = [];
  if (cellData && cellData.buildings.length > 0) {
    buildingParts = cellData.buildings.map((b: any) => {
      const bType = BUILDING_DISPLAY[b.type] || b.type;
      const underConstruction = b.productionTicksRemaining > 0;
      return `${bType}${underConstruction ? ` (${b.productionTicksRemaining}t)` : ''}`;
    });
  }

  return (
    <div id="hud-tooltip" style={{ left: `${tx}px`, top: `${ty}px`, right: 'auto' }}>
      <div class="tooltip-biome">{biomeText}</div>
      <div class="tooltip-owner" style={{ color: ownerColor }}>{ownerName}</div>
      {ruinText && <div class="tooltip-ruin">{ruinText}</div>}
      {resourceText && <div class="tooltip-resource">{resourceText}</div>}
      {buildingParts.length > 0 && <div class="tooltip-building">{buildingParts.join(', ')}</div>}
      <div class="tooltip-fog">{fogLabel}</div>
    </div>
  );
};