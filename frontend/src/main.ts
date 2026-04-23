import * as THREE from 'three';
import { generateHexGrid } from './globe/HexGrid';
import { GlobeRenderer } from './globe/GlobeRenderer';
import { FogOfWar } from './systems/FogOfWar';
import { CameraControls } from './camera/CameraControls';
import { HUD } from './ui/HUD';
import { createDebugAPI } from './debug/DebugAPI';
import { LobbyUI } from './ui/LobbyUI';
import { getRoomIdFromURL, setRoomIdInURL, clearRoomFromURL, getStoredRoomId, getDisplayName } from './network/RoomPersistence';
import { joinGame, reconnectToGame, sendExploreCell, leaveGame, sendUpdateCamera } from './network/ColyseusClient';
import { FogVisibility } from './types/index';

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
const fogOfWar = new FogOfWar(grid);
fogOfWar.revealStartingTerritory();
globeRenderer.forceColorUpdate();

let cameraRotated = false;

function rotateToCellCenter(center: [number, number, number]): void {
  if (cameraRotated) return;
  cameraRotated = true;
  const target = new THREE.Vector3(center[0], center[1], center[2]);
  const defaultForward = new THREE.Vector3(0, 0, 1);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    target.clone().normalize(),
    defaultForward,
  );
  pivot.quaternion.premultiply(quaternion);
}

const roomIdFromURL = getRoomIdFromURL();
const roomIdFromStorage = getStoredRoomId();
const roomId = roomIdFromURL || roomIdFromStorage;

if (!roomId) {
  const startingCenter = fogOfWar.getStartingCenter();
  if (startingCenter) rotateToCellCenter(startingCenter as [number, number, number]);
}

const leaveBtn = document.getElementById('hud-leave')!;
leaveBtn.addEventListener('click', handleLeaveGame);

const hud = new HUD();
const cameraControls = new CameraControls(camera, canvas, pivot);

(window as any).vantaris = createDebugAPI(grid, fogOfWar, globeRenderer, cameraControls, pivot);
console.log('%c[vantaris] Debug API available at window.vantaris', 'color: #4488ff; font-weight: bold');

let useServerState = false;

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
    fogOfWar.revealStartingTerritory();
    globeRenderer.forceColorUpdate();
  }
}

function handleLeaveGame(): void {
  leaveGame();
  clearRoomFromURL();
  localStorage.removeItem('vantaris_currentRoom');
  useServerState = false;
  leaveBtn.classList.add('hidden');
  for (const cell of grid.cells) {
    cell.fog = FogVisibility.UNREVEALED;
  }
  fogOfWar.revealStartingTerritory();
  globeRenderer.forceColorUpdate();
  cameraRotated = false;
  const startingCenter = fogOfWar.getStartingCenter();
  if (startingCenter) rotateToCellCenter(startingCenter as [number, number, number]);
  showLobby();
}

function handleGameRoom(room: any): void {
  useServerState = true;
  leaveBtn.classList.remove('hidden');
  cameraRotated = false;

  // Reset all fog to unrevealed, server will send visible cells
  for (const cell of grid.cells) {
    cell.fog = FogVisibility.UNREVEALED;
  }
  pivot.quaternion.identity();
  globeRenderer.forceColorUpdate();

  room.onMessage('stateUpdate', (slice: any) => {
    applyServerState(slice);
  });

  room.onMessage('pong', () => {
    // connection confirmed
  });

  room.onLeave(() => {
    useServerState = false;
    leaveBtn.classList.add('hidden');
  });
}

function applyServerState(slice: { visibleCells: any[]; revealedCells: any[]; players: any[]; camera?: { qx: number; qy: number; qz: number; qw: number; zoom: number } }): void {
  for (const cell of slice.visibleCells) {
    const idx = parseInt(cell.cellId.replace('cell_', ''));
    if (idx >= 0 && idx < grid.cells.length) {
      grid.cells[idx].fog = FogVisibility.VISIBLE;
    }
  }
  for (const cell of slice.revealedCells) {
    const idx = parseInt(cell.cellId.replace('cell_', ''));
    if (idx >= 0 && idx < grid.cells.length) {
      grid.cells[idx].fog = FogVisibility.REVEALED;
    }
  }
  globeRenderer.forceColorUpdate();

  if (!cameraRotated && slice.visibleCells.length > 0) {
    if (slice.camera) {
      const { qx, qy, qz, qw, zoom } = slice.camera;
      cameraControls.setQuaternion(qx, qy, qz, qw);
      cameraControls.setZoom(zoom);
      cameraRotated = true;
    } else {
      const firstVisible = slice.visibleCells[0];
      const firstIdx = parseInt(firstVisible.cellId.replace('cell_', ''));
      if (firstIdx >= 0 && firstIdx < grid.cells.length) {
        rotateToCellCenter(grid.cells[firstIdx].center);
      }
    }
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredCellId: number | null = null;
let lastCameraSync = 0;

canvas.addEventListener('pointermove', (e: PointerEvent) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

canvas.addEventListener('click', (e: MouseEvent) => {
  if (e.button !== 0) return;
  if (hoveredCellId !== null) {
    const cell = grid.cells[hoveredCellId];
    if (!cell || cell.fog !== FogVisibility.VISIBLE) return;
    if (useServerState) {
      sendExploreCell(`cell_${hoveredCellId}`);
    } else {
      const newlyRevealed = fogOfWar.expandFromCell(hoveredCellId);
      for (const cellId of newlyRevealed) {
        globeRenderer.beginRevealAnimation(cellId, grid.cells[cellId].fog);
      }
    }
  }
});

canvas.addEventListener('pointerleave', () => {
  hud.hideTooltip();
  hoveredCellId = null;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(): void {
  requestAnimationFrame(animate);

  cameraControls.update();
  globeRenderer.updateFogColors(16);

  raycaster.setFromCamera(pointer, camera);
  const globeGroup = globeRenderer.getGlobeGroup();
  const meshes: THREE.Object3D[] = [];
  globeGroup.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.cellId !== undefined) {
      meshes.push(child);
    }
  });
  const intersects = raycaster.intersectObjects(meshes, false);

  if (intersects.length > 0) {
    const cellId = globeRenderer.getCellAtIntersection(intersects[0]);
    if (cellId !== null) {
      hoveredCellId = cellId;
      const info = fogOfWar.getCellInfo(cellId);
      if (info) {
        const biome = info.fog === FogVisibility.VISIBLE ? info.biome : null;
        hud.showTooltip(cellId, biome, info.fog, info.isPentagon);
      }
    }
  } else {
    hud.hideTooltip();
    hoveredCellId = null;
  }

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