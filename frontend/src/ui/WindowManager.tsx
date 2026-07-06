import { FunctionalComponent } from 'preact';
import { openWindows } from '../state/windows';
import { GameWindow } from './GameWindow';

export const WindowManager: FunctionalComponent = () => {
  return (
    <div id="window-layer">
      {openWindows.value.map((win) => (
        <GameWindow key={win.id} win={win} />
      ))}
    </div>
  );
};