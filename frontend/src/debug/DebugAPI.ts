import * as THREE from 'three';
import type { HexGrid as HexGridData } from '../types/index';
import { FogVisibility } from '../types/index';
import type { FogOfWar } from '../systems/FogOfWar';
import type { GlobeRenderer } from '../globe/GlobeRenderer';
import type { CameraControls } from '../camera/CameraControls';

export interface DebugAPI {
  fog: {
    revealAll(): void;
    hideAll(): void;
    revealCell(id: number): void;
    revealTerritory(startId?: number): number[];
    getState(id: number): string | null;
    count(): { visible: number; explored: number; unexplored: number };
  };
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
  fogSystem: FogOfWar;
  cameraControls: CameraControls;
  pivot: THREE.Group;
}

export function createDebugAPI(
  grid: HexGridData,
  fogOfWar: FogOfWar,
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
    fog: {
      revealAll(): void {
        for (const cell of grid.cells) {
          if (cell.fog !== FogVisibility.VISIBLE) {
            cell.fog = FogVisibility.VISIBLE;
          }
        }
        globeRenderer.forceColorUpdate();
        console.log(`[debug] All ${grid.cells.length} cells revealed`);
      },

      hideAll(): void {
        for (const cell of grid.cells) {
          cell.fog = FogVisibility.UNREVEALED;
        }
        globeRenderer.forceColorUpdate();
        console.log('[debug] All cells hidden');
      },

      revealCell(id: number): void {
        const cell = grid.cells[id];
        if (!cell) {
          console.warn(`[debug] Cell ${id} not found`);
          return;
        }
        const newlyVisible = fogOfWar.expandFromCell(id);
        for (const cid of newlyVisible) {
          globeRenderer.beginRevealAnimation(cid, grid.cells[cid].fog);
        }
        console.log(`[debug] Expanded from cell ${id}, revealed: [${newlyVisible.join(', ')}]`);
      },

      revealTerritory(startId?: number): number[] {
        const idx = startId ?? Math.floor(Math.random() * grid.cells.length);
        const result = fogOfWar.revealStartingTerritory();
        globeRenderer.forceColorUpdate();
        console.log(`[debug] Revealed territory starting at cell ${idx}: [${result.join(', ')}]`);
        return result;
      },

      getState(id: number): string | null {
        const cell = grid.cells[id];
        if (!cell) return null;
        return cell.fog;
      },

      count(): { visible: number; explored: number; unexplored: number } {
        let visible = 0;
        let explored = 0;
        let unexplored = 0;
        for (const cell of grid.cells) {
        if (cell.fog === FogVisibility.VISIBLE) visible++;
        else if (cell.fog === FogVisibility.REVEALED) explored++;
          else unexplored++;
        }
        return { visible, explored, unexplored };
      },
    },

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
        const neighbors = grid.adjacency.get(id) ?? [];
        return {
          id: cell.id,
          biome: cell.biome,
          fog: cell.fog,
          isPentagon: cell.isPentagon,
          center: Array.from(cell.center),
          neighborIds: neighbors,
          neighborCount: neighbors.length,
        };
      },

      get cells(): object {
        return {
          total: grid.cells.length,
          pentagons: grid.cells.filter(c => c.isPentagon).length,
          hexagons: grid.cells.filter(c => !c.isPentagon).length,
          vertices: grid.vertices.length,
        };
      },

      get gridInfo(): object {
        return {
          total: grid.cells.length,
          pentagons: grid.cells.filter(c => c.isPentagon).length,
          hexagons: grid.cells.filter(c => !c.isPentagon).length,
          vertices: grid.vertices.length,
        };
      },

      fps(): number {
        return currentFps;
      },
    },

    grid,
    renderer: globeRenderer,
    fogSystem: fogOfWar,
    cameraControls,
    pivot,
  };

  return api;
}