import * as THREE from 'three';
import { generateHexGrid } from './globe/HexGrid';
import { GlobeRenderer } from './globe/GlobeRenderer';
import { FogRenderer } from './systems/FogRenderer';
import { UnitRenderer } from './systems/UnitRenderer';
import { CityRenderer } from './systems/CityRenderer';
import { SelectionRenderer } from './systems/SelectionRenderer';
import { CameraControls } from './camera/CameraControls';
import { HUD } from './ui/HUD';
import { LobbyUI } from './ui/LobbyUI';
import { GlobeInput } from './input/GlobeInput';
import { createDebugAPI } from './debug/DebugAPI';
import { getRoomIdFromURL, setRoomIdInURL, clearRoomFromURL, getStoredRoomId, getDisplayName } from './network/RoomPersistence';
import { joinGame, reconnectToGame, leaveGame, sendUpdateCamera } from './network/ColyseusClient';
import { clientState, clearClientState } from './state/ClientState';

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

const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(5, 3, 5);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x334466, 0.8);
scene.add(ambientLight);

const grid = generateHexGrid();

const globeRenderer = new GlobeRenderer(pivot, grid, scene);
const fogRenderer = new FogRenderer(pivot, grid, globeRenderer.getCellMeshes(), globeRenderer.getGlobeGroup());
const unitRenderer = new UnitRenderer(globeRenderer.getGlobeGroup(), grid);
const cityRenderer = new CityRenderer(globeRenderer.getGlobeGroup(), grid);
const selectionRenderer = new SelectionRenderer(globeRenderer.getGlobeGroup(), grid);

const leaveBtn = document.getElementById('hud-leave')!;
leaveBtn.addEventListener('click', handleLeaveGame);

const hud = new HUD();
const cameraControls = new CameraControls(camera, canvas, pivot);
const globeInput = new GlobeInput(canvas, camera, globeRenderer.getGlobeGroup());

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
  leaveBtn.classList.add('hidden');
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
  leaveBtn.classList.remove('hidden');
  pivot.quaternion.identity();

  room.onLeave(() => {
    useServerState = false;
    leaveBtn.classList.add('hidden');
  });
}

function handleLeaveGame(): void {
  leaveGame();
  clearRoomFromURL();
  localStorage.removeItem('vantaris_currentRoom');
  useServerState = false;
  leaveBtn.classList.add('hidden');
  pivot.quaternion.identity();
  showLobby();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(): void {
  requestAnimationFrame(animate);

  cameraControls.update();
  fogRenderer.updateFogColors();
  unitRenderer.update();
  selectionRenderer.update();

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