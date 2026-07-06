import { FunctionalComponent } from 'preact';
import { signal, useSignal, useComputed } from '@preact/signals';
import {
  viewMode,
  currentTick,
  sunAngle,
  dayNightCycleTicks,
  connected,
  lastTickTime,
  myPlayerId,
  resources,
  selectedTileId,
  selectedCellData,
  orbitalBodies,
  enterSystemView,
  enterPlanetView,
  focusedBodyId,
  viewedBodyId,
} from '../state/signals';
import { leaveGame } from '../network/ColyseusClient';
import { clearRoomFromURL } from '../network/RoomPersistence';
import type { OrbitalBodyData } from '@vantaris/shared';

interface MenuItem {
  label: string;
  action?: () => void;
  children?: MenuItem[];
}

const CONSTRUCT_CHILDREN: MenuItem[] = [
  { label: 'Iron Mine', action: () => console.log('[topbar] place Iron Mine') },
  { label: 'Iron Processing', action: () => console.log('[topbar] place Iron Processing') },
  { label: 'Steel Factory', action: () => console.log('[topbar] place Steel Factory') },
];

const TILE_CHILDREN: MenuItem[] = [
  { label: 'Rename…', action: () => console.log('[topbar] tile rename') },
  { label: 'Abandon', action: () => console.log('[topbar] tile abandon') },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const START_YEAR = 2200;

function formatGameDateTime(tick: number, cycleTicks: number): { date: string; time: string; isNight: boolean } {
  const daysElapsed = Math.floor(tick / cycleTicks);
  const frac = (tick % cycleTicks) / cycleTicks;
  const hoursTotal = frac * 24;
  const h = Math.floor(hoursTotal);
  const m = Math.floor((hoursTotal - h) * 60);
  const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

  const epochMs = Date.UTC(START_YEAR, 0, 1);
  const dateMs = epochMs + daysElapsed * 24 * 60 * 60 * 1000;
  const d = new Date(dateMs);
  const day = d.getUTCDate();
  const month = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const date = `${month} ${day}, ${year}`;

  const p = ((sunAngle.value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const isNight = Math.cos(p) < 0;
  return { date, time, isNight };
}

function handleLeave(): void {
  leaveGame();
  clearRoomFromURL();
  localStorage.removeItem('vantaris_currentRoom');
}

// Shared single-open state for all topbar dropdowns. Only one menu may be open
// at a time; opening one closes the others. Clicking outside the topbar closes it.
const openMenu = signal<string | null>(null);

function closeMenu(): void {
  openMenu.value = null;
}

function toggleMenu(id: string): void {
  openMenu.value = openMenu.value === id ? null : id;
}

const TopMenu: FunctionalComponent<{ id: string; item: MenuItem }> = ({ id, item }) => {
  const isOpen = useComputed(() => openMenu.value === id);
  const hoverTimer = useSignal<number | null>(null);
  // Track whether the menu was opened by hover (vs. by click). When hover opens
  // a menu, the subsequent click should NOT toggle it closed — it should just
  // keep it open. Only a click on an already-click-opened menu should close it.
  const openedByHover = useSignal(false);

  const onRootClick = (e: Event) => {
    e.stopPropagation();
    if (item.children && item.children.length > 0) {
      if (isOpen.value && !openedByHover.value) {
        // Opened by a previous click — toggle closed.
        closeMenu();
      } else {
        // Either closed, or opened by hover — open/stay open via click.
        openMenu.value = id;
        openedByHover.value = false;
      }
    } else if (item.action) {
      item.action();
      closeMenu();
    }
  };

  const onRootEnter = () => {
    if (!item.children || item.children.length === 0) return;
    if (hoverTimer.value) { clearTimeout(hoverTimer.value); hoverTimer.value = null; }
    hoverTimer.value = window.setTimeout(() => {
      openMenu.value = id;
      openedByHover.value = true;
    }, 150);
  };

  const onRootLeave = () => {
    if (hoverTimer.value) { clearTimeout(hoverTimer.value); hoverTimer.value = null; }
  };

  const onChildClick = (e: Event, child: MenuItem) => {
    e.stopPropagation();
    if (child.action) child.action();
    closeMenu();
  };

  // When switching to a different menu via hover, reset openedByHover.
  // We detect this by checking if the current open menu changed away from us.
  const onChildEnter = (e: Event, child: MenuItem) => {
    e.stopPropagation();
    if (child.children && child.children.length > 0) {
      if (hoverTimer.value) { clearTimeout(hoverTimer.value); hoverTimer.value = null; }
      hoverTimer.value = window.setTimeout(() => {
        openMenu.value = id;
        openedByHover.value = true;
      }, 150);
    }
  };

  return (
    <div class="topbar-menu" onMouseEnter={onRootEnter} onMouseLeave={onRootLeave}>
      <button class={isOpen.value ? 'topbar-menu-label active' : 'topbar-menu-label'} onClick={onRootClick}>
        {item.label}
      </button>
      {isOpen.value && item.children && (
        <div class="topbar-menu-dropdown">
          {item.children.map((child) => (
            <div
              class="topbar-menu-item-wrapper"
              onClick={(e) => onChildClick(e, child)}
              onMouseEnter={(e) => onChildEnter(e, child)}
            >
              <button class="topbar-menu-item">
                {child.label}
                {child.children && child.children.length > 0 && <span class="topbar-menu-arrow">▸</span>}
              </button>
              {child.children && child.children.length > 0 && (
                <div class="topbar-menu-subdropdown">
                  {child.children.map((sub) => (
                    <button class="topbar-menu-item" onClick={(e) => { e.stopPropagation(); sub.action?.(); closeMenu(); }}>
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EconomyMenu: FunctionalComponent = () => {
  const isOpen = useComputed(() => openMenu.value === 'economy');
  const r = resources.value;

  const onRootClick = (e: Event) => {
    e.stopPropagation();
    toggleMenu('economy');
  };

  return (
    <div class="topbar-menu">
      <button class={isOpen.value ? 'topbar-economy-label active' : 'topbar-economy-label'} onClick={onRootClick} title="Economy">
        ⚡ {Math.round(r.energyCredits)} <span class="econ-rate">+{Math.round(r.energyPerTick)}/t</span>
      </button>
      {isOpen.value && (
        <div class="topbar-menu-dropdown topbar-economy-dropdown">
          <div class="econ-section">
            <div class="econ-section-title">Resources</div>
            <div class="econ-row"><span>Food</span><span>{Math.round(r.food)}</span></div>
            <div class="econ-row"><span>Energy</span><span>{Math.round(r.energy)}</span></div>
            <div class="econ-row"><span>Energy Credits</span><span>{Math.round(r.energyCredits)}</span></div>
          </div>
          <div class="econ-section">
            <div class="econ-section-title">Rates</div>
            <div class="econ-row"><span>Food / tick</span><span>{Math.round(r.foodPerTick)}</span></div>
            <div class="econ-row"><span>Energy / tick</span><span>{Math.round(r.energyPerTick)}</span></div>
          </div>
          <div class="econ-section">
            <div class="econ-section-title">Population</div>
            <div class="econ-row"><span>Total</span><span>{Math.round(r.totalPopulation)}</span></div>
            <div class="econ-row"><span>Factories</span><span>{Math.round(r.factoryCount)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
};

function focusSpacecraft(bodyId: string): void {
  focusedBodyId.value = bodyId;
  enterPlanetView();
}

// Build a submenu for an orbital body by listing all its direct children
// (planets, moons, spacecraft) recursively. Each child that has its own
// children gets a nested submenu.
function buildBodyChildren(parentId: string): MenuItem[] {
  const children: MenuItem[] = [];
  for (const [, body] of orbitalBodies.value) {
    if (body.elements.parent !== parentId) continue;
    const grandChildren = buildBodyChildren(body.bodyId);
    children.push({
      label: body.name,
      action: () => {
        if (body.type === 'SPACECRAFT') {
          focusSpacecraft(body.bodyId);
        } else if (body.type === 'PLANET' || body.type === 'MOON') {
          enterPlanetView(body.bodyId);
        }
      },
      children: grandChildren.length > 0 ? grandChildren : undefined,
    });
  }
  return children;
}

// Build the System menu children dynamically from orbital bodies.
function buildSystemChildren(): MenuItem[] {
  // Find the star(s) — top-level bodies with no parent.
  const children: MenuItem[] = [];
  for (const [, body] of orbitalBodies.value) {
    if (!body.elements.parent) {
      const subChildren = buildBodyChildren(body.bodyId);
      children.push({
        label: body.name,
        action: () => enterSystemView(),
        children: subChildren.length > 0 ? subChildren : undefined,
      });
    }
  }
  return children;
}

function buildPlanetChildren(): MenuItem[] {
  // Show all bodies orbiting whatever planet/moon we're currently viewing.
  // For now, list all spacecraft and moons in the system.
  const children: MenuItem[] = [];
  for (const [, body] of orbitalBodies.value) {
    if (body.type === 'SPACECRAFT') {
      const scChildren = buildBodyChildren(body.bodyId);
      children.push({
        label: body.name,
        action: () => focusSpacecraft(body.bodyId),
        children: scChildren.length > 0 ? scChildren : undefined,
      });
    } else if (body.type === 'MOON') {
      const moonChildren = buildBodyChildren(body.bodyId);
      children.push({
        label: body.name,
        action: () => enterPlanetView(body.bodyId),
        children: moonChildren.length > 0 ? moonChildren : undefined,
      });
    }
  }
  return children;
}

export const TopBar: FunctionalComponent = () => {
  const inTileView = viewMode.value === 'tile';
  const { date, time, isNight } = formatGameDateTime(currentTick.value, dayNightCycleTicks.value);
  const icon = isNight ? '☽' : '☀';
  const hasPlayer = !!myPlayerId.value;

  const isConn = connected.value;
  const timeSinceTick = Date.now() - lastTickTime.value;
  const isStale = isConn && timeSinceTick > 10000;
  let statusDot = '';
  let statusClass = 'hud-conn-ok';
  if (!isConn) {
    statusDot = '●';
    statusClass = 'hud-conn-disconnected';
  } else if (isStale) {
    statusDot = '●';
    statusClass = 'hud-conn-stale';
  }

  const systemChildren = useComputed(() => buildSystemChildren());
  const planetChildren = useComputed(() => buildPlanetChildren());

  // Order: System, Planet, Tile, Construct. System is always visible.
  // Planet appears in system/planet/tile. Tile and Construct appear in tile view.
  const leftMenus: { id: string; item: MenuItem }[] = [];
  leftMenus.push({ id: 'system', item: { label: 'System', children: systemChildren.value } });
  if (viewMode.value !== 'system') {
    leftMenus.push({ id: 'planet', item: { label: 'Planet', children: planetChildren.value } });
  }
  if (inTileView) {
    leftMenus.push({ id: 'tile', item: { label: 'Tile', children: TILE_CHILDREN } });
    leftMenus.push({ id: 'construct', item: { label: 'Construct', children: CONSTRUCT_CHILDREN } });
  }

  const cellData = selectedCellData.value;
  const tileLabel = inTileView && cellData ? cellData.biome : null;

  return (
    <div id="topbar" onClick={(e) => e.stopPropagation()}>
      <div class="topbar-left">
        {leftMenus.map(({ id, item }) => (
          <TopMenu key={id} id={id} item={item} />
        ))}
      </div>
      <div class="topbar-right">
        {hasPlayer && <EconomyMenu />}
        <div class="topbar-clock">
          {icon} {date} {time} <span class={statusClass}>{statusDot}</span>
        </div>
        {tileLabel && <span class="topbar-tile-label">{tileLabel}</span>}
        {hasPlayer && (
          <button class="topbar-leave" onClick={(e) => { e.stopPropagation(); handleLeave(); }} title="Leave game">
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

// Close any open topbar dropdown when clicking outside the topbar.
if (typeof document !== 'undefined') {
  document.addEventListener('click', () => closeMenu());
}