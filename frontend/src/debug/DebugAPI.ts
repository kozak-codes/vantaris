import * as THREE from 'three';
import type { HexGrid as HexGridData } from '../types/index';
import type { GlobeRenderer } from '../globe/GlobeRenderer';
import type { CameraControls } from '../camera/CameraControls';
import { clientState } from '../state/ClientState';

export interface DebugAPI {
  camera: {
    focusCell(id: number): void;
    zoom(distance: number): void;
    resetRotation(): void;
    getZoom(): number;
  };
  state: {
    cell(id: number): object;
    cells: object;
    gridInfo: object;
    fps(): number;
  };
  grid: HexGridData;
  renderer: GlobeRenderer;
  cameraControls: CameraControls;
  pivot: THREE.Group;
  clientState: typeof clientState;
}

export function createDebugAPI(
  grid: HexGridData,
  globeRenderer: GlobeRenderer,
  cameraControls: CameraControls,
  pivot: THREE.Group,
): DebugAPI {
  let fpsFrameCount = 0;
  let fpsLastTime = performance.now();
  let currentFps = 0;

  function updateFps(): void {
    fpsFrameCount++;
    const now = performance.now();
    if (now - fpsLastTime >= 1000) {
      currentFps = fpsFrameCount;
      fpsFrameCount = 0;
      fpsLastTime = now;
    }
  }

  function fpsLoop(): void {
    updateFps();
    requestAnimationFrame(fpsLoop);
  }
  fpsLoop();

  const api: DebugAPI = {
    camera: {
      focusCell(id: number): void {
        const cell = grid.cells[id];
        if (!cell) {
          console.warn(`[debug] Cell ${id} not found`);
          return;
        }
        const target = new THREE.Vector3(cell.center[0], cell.center[1], cell.center[2]).normalize();
        const defaultForward = new THREE.Vector3(0, 0, 1);
        const quat = new THREE.Quaternion().setFromUnitVectors(target, defaultForward);
        pivot.quaternion.copy(quat);
        console.log(`[debug] Camera focused on cell ${id}`);
      },

      zoom(distance: number): void {
        const clamped = THREE.MathUtils.clamp(distance, 7, 25);
        (cameraControls as any).targetZoom = clamped;
        console.log(`[debug] Zoom target set to ${clamped}`);
      },

      resetRotation(): void {
        pivot.quaternion.identity();
        console.log('[debug] Rotation reset');
      },

      getZoom(): number {
        return (cameraControls as any).currentDistance;
      },
    },

    state: {
      cell(id: number): object {
        const cell = grid.cells[id];
        if (!cell) {
          console.warn(`[debug] Cell ${id} not found`);
          return {};
        }
        const cellKey = `cell_${id}`;
        const neighbors = grid.adjacency.get(id) ?? [];
        const visibility = clientState.visibleCells.has(cellKey)
          ? 'VISIBLE'
          : clientState.revealedCells.has(cellKey)
            ? 'REVEALED'
            : 'UNREVEALED';
        return {
          id: cell.id,
          biome: cell.biome,
          visibility,
          isPentagon: cell.isPentagon,
          center: Array.from(cell.center),
          neighborIds: neighbors,
          neighborCount: neighbors.length,
        };
      },

      get cells(): object {
        const visible = Array.from(clientState.visibleCells.keys()).length;
        const revealed = Array.from(clientState.revealedCells.keys()).length;
        return {
          total: grid.cells.length,
          pentagons: grid.cells.filter((c: any) => c.isPentagon).length,
          hexagons: grid.cells.filter((c: any) => !c.isPentagon).length,
          vertices: grid.vertices.length,
          clientVisible: visible,
          clientRevealed: revealed,
        };
      },

      get gridInfo(): object {
        return {
          total: grid.cells.length,
          pentagons: grid.cells.filter((c: any) => c.isPentagon).length,
          hexagons: grid.cells.filter((c: any) => !c.isPentagon).length,
          vertices: grid.vertices.length,
        };
      },

      fps(): number {
        return currentFps;
      },
    },

    grid,
    renderer: globeRenderer,
    cameraControls,
    pivot,
    clientState,
  };

  return api;
}