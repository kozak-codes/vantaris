import * as THREE from 'three';
import { generateHexGrid } from './globe/HexGrid';
import { GlobeRenderer } from './globe/GlobeRenderer';
import { FogOfWar } from './systems/FogOfWar';
import { CameraControls } from './camera/CameraControls';
import { HUD } from './ui/HUD';
import { createDebugAPI } from './debug/DebugAPI';

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
console.log(`Generated ${grid.cells.length} cells`);

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
console.log('  vantaris.fog.revealAll()     — reveal entire globe');
console.log('  vantaris.fog.hideAll()       — hide entire globe');
console.log('  vantaris.fog.revealCell(id)   — expand from a cell');
console.log('  vantaris.camera.focusCell(id) — point camera at cell');
console.log('  vantaris.camera.zoom(dist)    — zoom to distance');
console.log('  vantaris.state.cell(id)       — inspect a cell');

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredCellId: number | null = null;
let pointerDownPos = { x: 0, y: 0 };
let didDrag = false;

canvas.addEventListener('pointermove', (e: PointerEvent) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    didDrag = true;
  }
});

canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
  didDrag = false;
});

canvas.addEventListener('click', () => {
  if (didDrag) return;
  if (hoveredCellId !== null) {
    const newlyRevealed = fogOfWar.expandFromCell(hoveredCellId);
    for (const cellId of newlyRevealed) {
      globeRenderer.beginRevealAnimation(cellId, grid.cells[cellId].fog);
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