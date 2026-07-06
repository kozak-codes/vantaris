import { FunctionalComponent } from 'preact';
import {
  selectedTileId,
  selectedCellData,
  selectedRevealedData,
  players,
} from '../state/signals';

export const TileView: FunctionalComponent = () => {
  const tileId = selectedTileId.value;
  if (!tileId) return null;

  const cellData = selectedCellData.value;
  const revealedData = selectedRevealedData.value;
  if (!cellData && !revealedData) return null;

  const owner = cellData ? cellData.ownerId : (revealedData ? revealedData.lastKnownOwnerId : '');
  const ownerPlayer = owner ? players.value.get(owner) : null;
  const ownerName = ownerPlayer ? ownerPlayer.displayName : (owner ? 'Unknown' : 'Unclaimed');
  const ownerColor = ownerPlayer ? ownerPlayer.color : '#888';

  return (
    <div id="tile-view-overlay">
      <div class="tile-view-topbar">
        <div class="tile-view-title">
          <span class="tile-view-owner" style={ownerColor !== '#888' ? { color: ownerColor } : {}}>
            {ownerName}
          </span>
        </div>
      </div>
    </div>
  );
};