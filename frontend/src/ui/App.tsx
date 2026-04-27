import { FunctionalComponent } from 'preact';
import { selectedTileId, selectedCellData, selectedRevealedData, selectedUnit, selectedCity, players } from '../state/signals';
import { TickCounter } from './TickCounter';
import { ResourceBar } from './ResourceBar';
import { Tooltip } from './Tooltip';
import { UnitPanel } from './UnitPanel';
import { CityPanel } from './CityPanel';
import { TilePanel } from './TilePanel';
import { PlayerList } from './PlayerList';
import { EliminationOverlay } from './EliminationOverlay';
import { ChatPanel } from './ChatPanel';
import { BIOME_TRAVEL_NAMES } from './hud-shared';

const TilePanelContainer: FunctionalComponent = () => {
  const tileId = selectedTileId.value;
  if (!tileId) return <div id="hud-tile-panel" class="hidden panel" />;

  const cellData = selectedCellData.value;
  const revealedData = selectedRevealedData.value;
  if (!cellData && !revealedData) return <div id="hud-tile-panel" class="hidden panel" />;

  const biome = cellData ? cellData.biome : (revealedData ? revealedData.lastKnownBiome : '???');
  const owner = cellData ? cellData.ownerId : (revealedData ? revealedData.lastKnownOwnerId : '');
  const isRevealed = !cellData && !!revealedData;
  const ownerPlayer = owner ? players.value.get(owner) : null;
  const ownerName = ownerPlayer ? ownerPlayer.displayName : (owner ? 'Unknown' : 'Unclaimed');
  const ownerColor = ownerPlayer ? ownerPlayer.color : '#888';

  const unit = selectedUnit.value;
  const city = selectedCity.value;

  if (unit) {
    return <UnitPanel unit={unit} tileId={tileId} biome={biome} ownerName={ownerName} ownerColor={ownerColor} isRevealed={isRevealed} />;
  } else if (city) {
    return <CityPanel city={city} tileId={tileId} biome={biome} ownerName={ownerName} ownerColor={ownerColor} isRevealed={isRevealed} />;
  } else {
    return <TilePanel tileId={tileId} biome={biome} ownerName={ownerName} ownerColor={ownerColor} isRevealed={isRevealed} />;
  }
};

export const App: FunctionalComponent = () => {
  return (
    <>
      <TickCounter />
      <ResourceBar />
      <Tooltip />
      <TilePanelContainer />
      <PlayerList />
      <EliminationOverlay />
      <ChatPanel />
    </>
  );
};