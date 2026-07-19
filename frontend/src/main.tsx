import * as THREE from 'three';
import { render } from 'preact';
import { generateHexGrid } from './globe/HexGrid';
import { GlobeRenderer } from './globe/GlobeRenderer';
import { FogRenderer } from './systems/FogRenderer';
import { CityRenderer } from './systems/CityRenderer';
import { SelectionRenderer } from './systems/SelectionRenderer';
import { DayNightRenderer } from './systems/DayNightRenderer';
import { SpacecraftRenderer } from './systems/SpacecraftRenderer';
import { SubHexWorldRenderer } from './systems/SubHexWorldRenderer';
import { CameraControls } from './systems/CameraControls';
import { LobbyUI } from './ui/LobbyUI';
import { GlobeInput } from './systems/GlobeInput';
import { createDebugAPI } from './systems/DebugAPI';
import { getRoomIdFromURL, setRoomIdInURL, clearRoomFromURL, getStoredRoomId, getDisplayName } from './network/RoomPersistence';
import { joinGame, reconnectToGame, sendUpdateCamera, sendBuild, sendScrap } from './network/ColyseusClient';
import { CFG, ConstructionType, type ConstructionData } from '@vantaris/shared';
import { clientState, clearClientState, onStateUpdate, notifySelectionChanged } from './state/ClientState';
import { orbitalBodies, enterPlanetView, viewedBodyId, selectedTileId, viewMode, constructions, players, worldSeed } from './state/signals';
import { SystemView } from './systems/SystemView';
import { App } from './ui/App';

const canvas = document.getElementById('globe-canvas') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000008);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);

const pivot = new THREE.Group();
scene.add(pivot);

const ambientLight = new THREE.AmbientLight(0x556688, 1.2);
scene.add(ambientLight);

const grid = generateHexGrid();

const globeRenderer = new GlobeRenderer(pivot, grid, scene);
const fogRenderer = new FogRenderer(pivot, grid, globeRenderer.getCellMeshes(), globeRenderer.getGlobeGroup());
const cityRenderer = new CityRenderer(globeRenderer.getGlobeGroup(), grid);
const selectionRenderer = new SelectionRenderer(globeRenderer.getGlobeGroup(), grid);
const dayNightRenderer = new DayNightRenderer(ambientLight, globeRenderer.getGlobeGroup(), fogRenderer.getCellMeshMap());
const spacecraftRenderer = new SpacecraftRenderer(globeRenderer.getGlobeGroup());
spacecraftRenderer.setGrid(grid);
const subHexRenderer = new SubHexWorldRenderer(globeRenderer.getGlobeGroup(), globeRenderer.getCellMeshes());

// Build a map of cellId → geometry data (center + boundary vertex positions)
// for the SubHexWorldRenderer to use when building sub-hex terrain.
const cellGeometryMap = new Map<string, { center: [number, number, number]; vertexPositions: [number, number, number][]; vertexIds?: number[] }>();
for (const cell of grid.cells) {
  const vertexPositions: [number, number, number][] = cell.vertexIds.map((fi: number) => {
    const dv = grid.vertices[fi];
    return [dv[0], dv[1], dv[2]] as [number, number, number];
  });
  cellGeometryMap.set(`cell_${cell.id}`, {
    center: cell.center,
    vertexPositions,
    vertexIds: cell.vertexIds,
  });
}

render(<App />, document.getElementById('hud-root')!);
const cameraControls = new CameraControls(camera, canvas, pivot);
const globeInput = new GlobeInput(canvas, camera, globeRenderer.getGlobeGroup());
globeInput.setGrid(grid);
globeInput.setCameraControls(cameraControls);

// Zoom thresholds for auto-selecting tiles.
const TILE_VIEW_ZOOM = CFG.CAMERA.tileViewZoom;
const TILE_VIEW_MAX_ZOOM = CFG.CAMERA.tileViewMaxZoom;

// Click a tile to zoom into it.
globeInput.setTileViewHandlers(
  (cellId: string) => {
    const numericId = parseInt(cellId.replace('cell_', ''));
    if (isNaN(numericId) || numericId < 0 || numericId >= grid.cells.length) return;
    const center = grid.cells[numericId].center;
    cameraControls.focusCellZoomed(center, TILE_VIEW_ZOOM);
  },
  () => {},
);

// Click to place a building on the clicked sub-hex (build mode).
let buildType: ConstructionType = 'HAB';
let buildMode = false;
canvas.addEventListener('click', (e) => {
  if (!buildMode) return;
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const pick = subHexRenderer.pickSubHex(camera, pointer);
  if (!pick) return;
  const sub = subHexRenderer.getSubHex(pick.cellId, pick.subHexIndex);
  if (!sub || !sub.buildable) return;
  sendBuild(pick.cellId, pick.subHexIndex, buildType);
  buildMode = false;
});

// Expose build mode toggle via debug API for now.
(window as any).vantarisBuild = (type: ConstructionType) => {
  buildType = type;
  buildMode = true;
  console.log(`[tile] Build mode: ${type}. Click a sub-hex to place.`);
};

// System view lifecycle: show/hide the globe canvas and manage the SystemView
// renderer instance as the player navigates between system and planet views.
const systemContainer = document.getElementById('system-view-container') as HTMLDivElement;
let systemView: SystemView | null = null;
let prevViewMode: string = '';

function showSystemView(): void {
  canvas.style.display = 'none';
  systemContainer.classList.remove('hidden');
  if (!systemView) {
    systemView = new SystemView(systemContainer);
    systemView.setHandlers(
      (bodyId?: string) => {
        if (bodyId) {
          enterPlanetView(bodyId);
        } else {
          enterPlanetView();
        }
      },
      (bodyId: string) => console.log('[system] picked body', bodyId),
    );
  }
  systemView.onBodiesChanged();
  systemView.resize();
}

function hideSystemView(): void {
  canvas.style.display = '';
  systemContainer.classList.add('hidden');
}

function applyViewMode(mode: string): void {
  if (mode === 'system') {
    showSystemView();
    cameraControls.setEnabled(false);
  } else {
    hideSystemView();
    cameraControls.setEnabled(true);
    if (prevViewMode === 'system') {
      cameraControls.returnToWorldView();
    }
  }
}

onStateUpdate(() => {
  const mode = clientState.viewMode;
  if (mode === prevViewMode) {
    if (mode === 'system' && systemView) systemView.onBodiesChanged();
    return;
  }
  prevViewMode = mode;
  applyViewMode(mode);
});

// Rebuild sub-hex terrain when visible/revealed cells or world seed change.
onStateUpdate(() => {
  subHexRenderer.setWorldSeed(clientState.worldSeed);
  const allCellIds = new Set(grid.cells.map((c: { id: number }) => `cell_${c.id}`));
  subHexRenderer.updateVisibility(clientState.visibleCells, cellGeometryMap, clientState.revealedCells, grid.adjacency, allCellIds);
  subHexRenderer.updateConstructions(clientState.constructions);
});

// Force the initial view mode to be applied (the watcher only fires on changes).
applyViewMode(clientState.viewMode);

window.addEventListener('resize', () => {
  if (systemView) systemView.resize();
});

(window as any).vantaris = createDebugAPI(grid, globeRenderer, cameraControls, pivot);
console.log('%c[vantaris] Debug API available at window.vantaris', 'color: #4488ff; font-weight: bold');

let useServerState = false;
let lastCameraSync = 0;

const roomIdFromURL = getRoomIdFromURL();
const roomIdFromStorage = getStoredRoomId();
const roomId = roomIdFromURL || roomIdFromStorage;

if (roomId) {
  attemptReconnect(roomId);
} else {
  showLobby();
}

async function attemptReconnect(id: string): Promise<void> {
  try {
    const room = await reconnectToGame(id);
    cameraControls.setEnabled(true);
    handleGameRoom(room);
  } catch {
    clearRoomFromURL();
    localStorage.removeItem('vantaris_currentRoom');
    showLobby();
  }
}

function showLobby(): void {
  const lobbyUI = new LobbyUI();
  cameraControls.setEnabled(false);
  lobbyUI.setOnGameReady((newRoomId: string) => {
    handleGameJoin(newRoomId);
  });
}

async function handleGameJoin(newRoomId: string): Promise<void> {
  try {
    const room = await joinGame(newRoomId, getDisplayName());
    setRoomIdInURL(newRoomId);
    cameraControls.setEnabled(true);
    handleGameRoom(room);
  } catch {
    clearRoomFromURL();
  }
}

function handleGameRoom(room: any): void {
  useServerState = true;
  pivot.quaternion.identity();

  room.onLeave(() => {
    useServerState = false;
  });
}

window.addEventListener('resize', () => {
  if (systemView) systemView.resize();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Auto-select tile under the screen center.
const autoSelectRaycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

function getCellAtScreenCenter(): string | null {
  autoSelectRaycaster.setFromCamera(screenCenter, camera);
  const hexMeshes: THREE.Object3D[] = [];
  globeRenderer.getGlobeGroup().traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.cellId !== undefined) {
      hexMeshes.push(child);
    }
  });
  const hits = autoSelectRaycaster.intersectObjects(hexMeshes, false);
  if (hits.length === 0) return null;
  const cellId = typeof hits[0].object.userData.cellId === 'number'
    ? `cell_${hits[0].object.userData.cellId}`
    : hits[0].object.userData.cellId as string;
  if (!cellId) return null;
  if (!clientState.visibleCells.has(cellId) && !clientState.revealedCells.has(cellId)) return null;
  return cellId;
}

function animate(): void {
  requestAnimationFrame(animate);

  cameraControls.update();

  const zoom = cameraControls.getZoom();

  if (clientState.viewMode !== 'system') {
    // Auto-select the tile under the screen center when zoomed in.
    if (zoom <= TILE_VIEW_ZOOM) {
      const cellId = getCellAtScreenCenter();
      if (cellId && cellId !== clientState.selectedTileId) {
        clientState.selectedTileId = cellId;
        notifySelectionChanged();
      }
    } else if (zoom > TILE_VIEW_MAX_ZOOM && clientState.selectedTileId) {
      clientState.selectedTileId = null;
      notifySelectionChanged();
    }
  }

  fogRenderer.updateFogColors();
  selectionRenderer.update();
  dayNightRenderer.update();
  spacecraftRenderer.update(camera);
  subHexRenderer.update();
  subHexRenderer.updateConstructions(clientState.constructions);

  subHexRenderer.setVisible(clientState.viewMode !== 'system');

  globeRenderer.updateGlow(camera);

  if (useServerState) {
    const now = performance.now();
    if (now - lastCameraSync > 1000) {
      const q = cameraControls.getQuaternion();
      sendUpdateCamera(q.x, q.y, q.z, q.w, cameraControls.getZoom());
      lastCameraSync = now;
    }
  }

  renderer.render(scene, camera);
}

animate();