import * as THREE from 'three';
import { generateHexGrid } from './globe/HexGrid';
import { GlobeRenderer } from './globe/GlobeRenderer';
import { FogOfWar } from './systems/FogOfWar';
import { CameraControls } from './camera/CameraControls';
import { HUD } from './ui/HUD';
import { createDebugAPI } from './debug/DebugAPI';
import { LobbyUI } from './ui/LobbyUI';
import { getRoomIdFromURL, setRoomIdInURL, clearRoomFromURL, getDisplayName } from './network/RoomPersistence';
import { joinGame, reconnect, sendExploreCell } from './network/ColyseusClient';
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

const startingCenter = fogOfWar.getStartingCenter();
if (startingCenter) {
  const target = new THREE.Vector3(startingCenter[0], startingCenter[1], startingCenter[2]);
  const defaultForward = new THREE.Vector3(0, 0, 1);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    target.clone().normalize(),
    defaultForward,
  );
  pivot.quaternion.premultiply(quaternion);
}

const hud = new HUD();
const cameraControls = new CameraControls(camera, canvas, pivot);

(window as any).vantaris = createDebugAPI(grid, fogOfWar, globeRenderer, cameraControls, pivot);
console.log('%c[vantaris] Debug API available at window.vantaris', 'color: #4488ff; font-weight: bold');

let useServerState = false;

const roomId = getRoomIdFromURL();
if (roomId) {
  attemptReconnect(roomId);
} else {
  showLobby();
}

async function attemptReconnect(id: string): Promise<void> {
  try {
    const room = await reconnect(id);
    handleGameRoom(room);
  } catch {
    clearRoomFromURL();
    showLobby();
  }
}

function showLobby(): void {
  const lobbyUI = new LobbyUI();
  lobbyUI.setOnGameReady((newRoomId: string) => {
    handleGameJoin(newRoomId);
  });
}

async function handleGameJoin(newRoomId: string): Promise<void> {
  try {
    const room = await joinGame(newRoomId, getDisplayName());
    handleGameRoom(room);
  } catch {
    // If join fails, run local mode
    fogOfWar.revealStartingTerritory();
    globeRenderer.forceColorUpdate();
  }
}

function handleGameRoom(room: any): void {
  useServerState = true;

  room.onMessage('stateUpdate', (slice: any) => {
    applyServerState(slice);
  });

  room.onMessage('pong', (data: any) => {
    // connection confirmed
  });

  room.onLeave(() => {
    useServerState = false;
  });
}

function applyServerState(slice: { visibleCells: any[]; revealedCells: any[]; players: any[] }): void {
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
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredCellId: number | null = null;

canvas.addEventListener('pointermove', (e: PointerEvent) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

canvas.addEventListener('click', (e: MouseEvent) => {
  if (e.button !== 0) return;
  if (hoveredCellId !== null) {
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
        hud.showTooltip(cellId, info.biome, info.fog, info.isPentagon);
      }
    }
  } else {
    hud.hideTooltip();
    hoveredCellId = null;
  }

  globeRenderer.updateGlow(camera);
  renderer.render(scene, camera);
}

animate();