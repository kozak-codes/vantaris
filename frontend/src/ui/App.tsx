import { FunctionalComponent } from 'preact';
import { viewMode, orbitalBodies, viewedBodyId, exitPlanetView } from '../state/signals';
import { ChatPanel } from './ChatPanel';
import { TileView } from './TileView';
import { TopBar } from './TopBar';
import { WindowManager } from './WindowManager';

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
      {mode === 'planet' && <PlanetView />}
      <TileView />
      <WindowManager />
      <ChatPanel />
    </>
  );
};