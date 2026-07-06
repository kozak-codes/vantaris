import * as THREE from 'three';
import { render } from 'preact';
import { generateHexGrid } from './globe/HexGrid';
import { GlobeRenderer } from './globe/GlobeRenderer';
import { FogRenderer } from './systems/FogRenderer';
import { CityRenderer } from './systems/CityRenderer';
import { SelectionRenderer } from './systems/SelectionRenderer';
import { RuinRenderer } from './systems/RuinRenderer';
import { DayNightRenderer } from './systems/DayNightRenderer';
import { SpacecraftRenderer } from './systems/SpacecraftRenderer';
import { CameraControls } from './systems/CameraControls';
import { LobbyUI } from './ui/LobbyUI';
import { GlobeInput } from './systems/GlobeInput';
import { createDebugAPI } from './systems/DebugAPI';
import { getRoomIdFromURL, setRoomIdInURL, clearRoomFromURL, getStoredRoomId, getDisplayName } from './network/RoomPersistence';
import { joinGame, reconnectToGame, sendUpdateCamera } from './network/ColyseusClient';
import { CFG } from '@vantaris/shared';
import { clientState, clearClientState, onStateUpdate } from './state/ClientState';
import { setTileViewExitHandler, orbitalBodies, enterPlanetView, focusedBodyId, viewedBodyId } from './state/signals';
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
const ruinRenderer = new RuinRenderer(globeRenderer.getGlobeGroup(), grid);
const dayNightRenderer = new DayNightRenderer(ambientLight, globeRenderer.getGlobeGroup(), fogRenderer.getCellMeshMap());
const spacecraftRenderer = new SpacecraftRenderer(globeRenderer.getGlobeGroup());

render(<App />, document.getElementById('hud-root')!);
const cameraControls = new CameraControls(camera, canvas, pivot);
const globeInput = new GlobeInput(canvas, camera, globeRenderer.getGlobeGroup());
globeInput.setCameraControls(cameraControls);

// Tile-view camera controller: tween into the selected hex on enter, back out on exit.
// Globe radius is 5 (CFG.GLOBE.radius); a camera distance of ~6.5 puts the cell
// surface ~1.5 units from the camera so the hex fills the viewport.
const TILE_VIEW_ZOOM = 6.5;
globeInput.setTileViewHandlers(
  (cellId: string) => {
    const numericId = parseInt(cellId.replace('cell_', ''));
    if (isNaN(numericId) || numericId < 0 || numericId >= grid.cells.length) return;
    const center = grid.cells[numericId].center;
    console.log('[tile-view] entering tile', cellId, 'center=', center);
    cameraControls.setEnabled(false);
    cameraControls.focusCellZoomed(center, TILE_VIEW_ZOOM);
  },
  () => {
    cameraControls.setEnabled(true);
    cameraControls.returnToWorldView();
  },
);
setTileViewExitHandler(() => {
  cameraControls.setEnabled(true);
  cameraControls.returnToWorldView();
});

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
    cameraControls.returnToWorldView();
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

let focusBodyId: string | null = null;
onStateUpdate(() => {
  focusBodyId = focusedBodyId.value;
});

// Focus the camera on a spacecraft in planet view. Sets the camera's look
// target to the spacecraft's world position so the camera tracks it as it
// orbits. Does NOT override the player's pivot rotation or zoom — the player
// can still rotate and zoom freely while the camera follows the spacecraft.
function updateSpacecraftFocus(): void {
  if (!focusBodyId || clientState.viewMode === 'system') {
    cameraControls.setLookTarget(null);
    return;
  }
  const body = orbitalBodies.value.get(focusBodyId);
  if (!body || body.type !== 'SPACECRAFT') {
    cameraControls.setLookTarget(null);
    return;
  }
  const parent = orbitalBodies.value.get(body.elements.parent);
  if (!parent) {
    cameraControls.setLookTarget(null);
    return;
  }

  const kmPerUnit = CFG.SYSTEM.PLANET_RADIUS_KM / 5;
  const relX = (body.position[0] - parent.position[0]) / kmPerUnit;
  const relY = (body.position[1] - parent.position[1]) / kmPerUnit;
  const relZ = (body.position[2] - parent.position[2]) / kmPerUnit;
  const localPos = new THREE.Vector3(relX, relY, relZ);

  // The spacecraft's world position is its local position transformed by the pivot.
  pivot.updateMatrixWorld();
  const worldPos = localPos.clone().applyMatrix4(pivot.matrixWorld);
  cameraControls.setLookTarget(worldPos);
}

function animate(): void {
  requestAnimationFrame(animate);

  cameraControls.update();
  updateSpacecraftFocus();
    fogRenderer.updateFogColors();
    selectionRenderer.update();
    ruinRenderer.update();
    dayNightRenderer.update();
    spacecraftRenderer.update(camera);

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