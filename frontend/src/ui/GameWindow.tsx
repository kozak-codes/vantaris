import { FunctionalComponent } from 'preact';
import { useSignal, useComputed } from '@preact/signals';
import type { GameWindowState } from '../state/windows';
import { closeWindow, focusWindow, togglePin, toggleFavorite, isFavorite, moveWindow, setPinned } from '../state/windows';
import { enterPlanetView, enterSystemView } from '../state/signals';
import { orbitalBodies } from '../state/signals';

function viewAction(win: GameWindowState): void {
  // The content props tell us what to view. We check for bodyId on the props.
  const bodyId = win.content.props?.bodyId as string | undefined;
  if (!bodyId) return;
  const body = orbitalBodies.value.get(bodyId);
  if (!body) return;
  if (body.type === 'STAR') {
    enterSystemView();
  } else if (body.type === 'PLANET' || body.type === 'MOON') {
    enterPlanetView(body.bodyId);
  } else {
    // Spacecraft: enter free planet view (view the parent body) without
    // locking focus on the spacecraft. The player can rotate freely.
    enterPlanetView(body.elements.parent);
  }
}

export const GameWindow: FunctionalComponent<{ win: GameWindowState }> = ({ win }) => {
  const dragState = useSignal<{ active: boolean; offsetX: number; offsetY: number }>({ active: false, offsetX: 0, offsetY: 0 });
  const fav = useComputed(() => isFavorite(win.id));
  const Content = win.content.component;
  const contentProps = win.content.props;

  const onHeaderMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    focusWindow(win.id);
    dragState.value = { active: true, offsetX: e.clientX - win.x, offsetY: e.clientY - win.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragState.value.active) return;
      const x = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - dragState.value.offsetX));
      const y = Math.max(40, Math.min(window.innerHeight - 40, ev.clientY - dragState.value.offsetY));
      moveWindow(win.id, x, y);
    };
    const onUp = () => {
      dragState.value = { ...dragState.value, active: false };
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Auto-pin when moved.
      setPinned(win.id, true);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  };

  const onFavClick = (e: Event) => {
    e.stopPropagation();
    toggleFavorite(win.id);
  };

  return (
    <div
      class="game-window"
      style={{ left: `${win.x}px`, top: `${win.y}px`, zIndex: win.zIndex }}
      onMouseDown={() => focusWindow(win.id)}
    >
      <div class="game-window-header" onMouseDown={onHeaderMouseDown}>
        <span class="game-window-title">{win.title}</span>
        <div class="game-window-buttons">
          <button class={`gwin-btn ${win.content.props?.bodyId ? '' : 'gwin-hidden'}`} onClick={() => viewAction(win)} title="View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button class={`gwin-btn ${win.pinned ? 'gwin-active' : 'gwin-outline'}`} onClick={() => togglePin(win.id)} title="Pin">
            <svg width="14" height="14" viewBox="0 0 24 24" fill={win.pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
              <path d="M12 17v5M9 10.76a6 6 0 0 1 6 0V3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1z" />
            </svg>
          </button>
          <button class={`gwin-btn ${fav.value ? 'gwin-active' : 'gwin-outline'}`} onClick={onFavClick} title="Favorite">
            <svg width="14" height="14" viewBox="0 0 24 24" fill={fav.value ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          <button class="gwin-btn" onClick={() => closeWindow(win.id)} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div class="game-window-body">
        <Content {...contentProps} />
      </div>
    </div>
  );
};