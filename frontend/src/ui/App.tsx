import { FunctionalComponent } from 'preact';
import { viewMode, orbitalBodies, viewedBodyId } from '../state/signals';
import { ChatPanel } from './ChatPanel';
import { TileView } from './TileView';
import { TopBar } from './TopBar';
import { exitPlanetView } from '../state/signals';

const PlanetView: FunctionalComponent = () => {
  const bodyId = viewedBodyId.value;
  const body = bodyId ? orbitalBodies.value.get(bodyId) : null;
  const label = body?.name ?? 'Planet';
  return (
    <div class="planet-view-bar">
      <button class="planet-view-back" onClick={() => exitPlanetView()} title="Back to system (Esc)">
        ↑ System
      </button>
      <span class="planet-view-label">{label}</span>
    </div>
  );
};

export const App: FunctionalComponent = () => {
  const mode = viewMode.value;
  return (
    <>
      <TopBar />
      {mode === 'tile' && <TileView />}
      {(mode === 'planet' || mode === 'world') && <PlanetView />}
      <ChatPanel />
    </>
  );
};