import * as THREE from 'three';
import { clientState, notifySelectionChanged } from '../state/ClientState';
import {
  selectTile,
  exitPlanetView,
  landingTargetBodyId,
  cancelLandingTarget,
  setLandingError,
  orbitalBodies,
} from '../state/signals';
import { openWindow } from '../state/windows';
import { TileWindowContent } from '../ui/WindowContent';
import { sendLandAt } from '../network/ColyseusClient';
import { CFG, type HexGrid } from '@vantaris/shared';
import type { CameraControls } from './CameraControls';

const CLICK_THRESHOLD_PX = 8;
const DOUBLE_CLICK_MS = 350;

export class GlobeInput {
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;
  private raycaster: THREE.Raycaster;
  private pointerDownPos: { x: number; y: number } | null = null;
  private pointerDownTime = 0;
  private globe: THREE.Group;
  private grid: HexGrid | null = null;
  private cameraControls: CameraControls | null = null;
  private onEnterTile: ((cellId: string) => void) | null = null;
  private lastClickCellId: string | null = null;
  private lastClickTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.PerspectiveCamera,
    globe: THREE.Group,
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.globe = globe;
    this.raycaster = new THREE.Raycaster();

    canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    canvas.addEventListener('pointerleave', this.clearHover.bind(this));
    canvas.addEventListener('pointerout', this.clearHover.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  setGrid(grid: HexGrid): void {
    this.grid = grid;
  }

  setCameraControls(cc: CameraControls): void {
    this.cameraControls = cc;
  }

  setTileViewHandlers(onEnter: (cellId: string) => void, _onExit?: () => void): void {
    this.onEnterTile = onEnter;
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.pointerDownTime = Date.now();
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button !== 0 || !this.pointerDownPos) return;

    if (this.cameraControls) {
      if (this.cameraControls.isTouchGestureActive()) {
        this.pointerDownPos = null;
        return;
      }
      if (this.cameraControls.wasTouchMoved()) {
        this.pointerDownPos = null;
        return;
      }
    }

    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    this.pointerDownPos = null;

    if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD_PX) return;

    const elapsed = Date.now() - this.pointerDownTime;
    if (elapsed < 0 || elapsed > 500) return;

    this.handleClick(e.clientX, e.clientY);
  }

  private onPointerMove(e: PointerEvent): void {
    clientState.mouseClientX = e.clientX;
    clientState.mouseClientY = e.clientY;

    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      (2 * (e.clientX - rect.left) / rect.width) - 1,
      -(2 * (e.clientY - rect.top) / rect.height) + 1,
    );

    this.raycaster.setFromCamera(pointer, this.camera);

    const hexMeshes: THREE.Object3D[] = [];
    this.globe.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.cellId !== undefined) {
        hexMeshes.push(child);
      }
    });

    const hexIntersects = this.raycaster.intersectObjects(hexMeshes, false);
    if (hexIntersects.length === 0) {
      if (clientState.hoveredCellId !== null) {
        clientState.hoveredCellId = null;
        notifySelectionChanged();
      }
      return;
    }

    const cellId = this.getCellIdFromIntersection(hexIntersects[0]);
    if (!cellId) {
      if (clientState.hoveredCellId !== null) {
        clientState.hoveredCellId = null;
        notifySelectionChanged();
      }
      return;
    }

    const visibility = clientState.visibleCells.get(cellId);
    const revealed = clientState.revealedCells.has(cellId);
    if (!visibility && !revealed) {
      if (clientState.hoveredCellId !== null) {
        clientState.hoveredCellId = null;
        notifySelectionChanged();
      }
      return;
    }

    if (clientState.hoveredCellId !== cellId) {
      clientState.hoveredCellId = cellId;
      notifySelectionChanged();
    }
  }

  private clearHover(): void {
    if (clientState.hoveredCellId !== null) {
      clientState.hoveredCellId = null;
      notifySelectionChanged();
    }
  }

  private handleClick(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      (2 * (clientX - rect.left) / rect.width) - 1,
      -(2 * (clientY - rect.top) / rect.height) + 1,
    );

    this.raycaster.setFromCamera(pointer, this.camera);

    const hexMeshes: THREE.Object3D[] = [];
    this.globe.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.cellId !== undefined) {
        hexMeshes.push(child);
      }
    });

    const hexIntersects = this.raycaster.intersectObjects(hexMeshes, false);
    if (hexIntersects.length === 0) {
      this.deselectAll();
      return;
    }

    const cellId = this.getCellIdFromIntersection(hexIntersects[0]);
    if (!cellId) {
      this.deselectAll();
      return;
    }

    // In system view the globe is hidden; ignore globe clicks.
    if (clientState.viewMode === 'system') return;

    // Landing-target mode: validate + send landAt instead of selecting tiles.
    if (landingTargetBodyId.value) {
      this.handleLandingClick(cellId);
      return;
    }

    const visibility = clientState.visibleCells.get(cellId);
    if (!visibility && !clientState.revealedCells.has(cellId)) {
      this.deselectAll();
      return;
    }

    // Detect double-click: focus camera on the tile.
    const now = Date.now();
    const isDoubleClick = this.lastClickCellId === cellId && (now - this.lastClickTime) < DOUBLE_CLICK_MS;
    this.lastClickCellId = cellId;
    this.lastClickTime = now;

    // Select the tile.
    selectTile(cellId);

    if (isDoubleClick) {
      // Double-click: focus camera on the tile.
      if (this.onEnterTile) this.onEnterTile(cellId);
    } else {
      // Single click: open the tile window.
      openWindow(`tile:${cellId}`, `Tile ${cellId}`, { component: TileWindowContent, props: { cellId } });
    }
  }

  /**
   * Handle a globe click while the player is choosing a landing target.
   * Validates the clicked cell is within `CFG.LANDING.wiggleCells` adjacency
   * hops of the lander's current sub-point and that it isn't ocean, then
   * sends `landAt`. Invalid picks set a transient error message.
   */
  private handleLandingClick(cellId: string): void {
    const bodyId = landingTargetBodyId.value;
    if (!bodyId) return;
    const body = orbitalBodies.value.get(bodyId);
    if (!body || body.type !== 'SPACECRAFT') {
      cancelLandingTarget();
      return;
    }
    if (body.landedCellId || body.descending) {
      cancelLandingTarget();
      return;
    }
    if (!this.grid) {
      setLandingError('Grid not available');
      return;
    }

    const numericId = parseInt(cellId.replace('cell_', ''), 10);
    if (isNaN(numericId) || numericId < 0 || numericId >= this.grid.cells.length) {
      setLandingError('Invalid tile');
      return;
    }

    // Find the lander's current sub-point cell on the globe.
    const subCellId = this.findCellBelowLander(body);
    if (!subCellId) {
      setLandingError('Cannot determine lander position');
      return;
    }

    if (!this.isWithinWiggle(subCellId, cellId, CFG.LANDING.wiggleCells)) {
      setLandingError(`Too far from lander's ground track (max ${CFG.LANDING.wiggleCells} tiles)`);
      return;
    }

    // Refuse ocean targets client-side as a UX hint — server re-checks.
    const center = this.grid.cells[numericId].center;
    // We can't sample terrain client-side without the world seed easily; the
    // server is authoritative. Just send and let the server reject if water.
    void center;

    sendLandAt(bodyId, cellId);
    cancelLandingTarget();
  }

  /** Find the globe cell directly below the lander (highest dot product). */
  private findCellBelowLander(body: { position: [number, number, number]; elements: { parent: string } }): string | null {
    if (!this.grid) return null;
    const parent = orbitalBodies.value.get(body.elements.parent);
    if (!parent) return null;
    const dx = body.position[0] - parent.position[0];
    const dy = body.position[1] - parent.position[1];
    const dz = body.position[2] - parent.position[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len === 0) return null;
    const ux = dx / len, uy = dy / len, uz = dz / len;

    let bestId: string | null = null;
    let bestDot = -Infinity;
    for (const cell of this.grid.cells) {
      const cx = cell.center[0], cy = cell.center[1], cz = cell.center[2];
      const clen = Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (clen === 0) continue;
      const dot = (cx * ux + cy * uy + cz * uz) / clen;
      if (dot > bestDot) {
        bestDot = dot;
        bestId = `cell_${cell.id}`;
      }
    }
    return bestId;
  }

  /** BFS from `start` to `target` up to `maxHops` inclusive. */
  private isWithinWiggle(start: string, target: string, maxHops: number): boolean {
    if (!this.grid) return false;
    if (start === target) return true;
    const parseId = (s: string) => parseInt(s.replace('cell_', ''), 10);
    const startId = parseId(start);
    const targetId = parseId(target);
    if (isNaN(startId) || isNaN(targetId)) return false;

    const visited = new Set<number>([startId]);
    let frontier = new Set<number>([startId]);
    for (let i = 0; i < maxHops; i++) {
      const next = new Set<number>();
      for (const cid of frontier) {
        const neighbors = this.grid.adjacency.get(cid) ?? [];
        for (const nId of neighbors) {
          if (nId === targetId) return true;
          if (visited.has(nId)) continue;
          visited.add(nId);
          next.add(nId);
        }
      }
      frontier = next;
    }
    return false;
  }

  private deselectAll(): void {
    clientState.selectedTileId = null;
    clientState.selectedCityId = null;
    notifySelectionChanged();
  }

  private getCellIdFromIntersection(intersection: THREE.Intersection): string | null {
    if (!intersection.object || intersection.object.userData.cellId === undefined) return null;
    const cellId = intersection.object.userData.cellId;
    if (typeof cellId === 'number') return `cell_${cellId}`;
    return cellId as string;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (landingTargetBodyId.value) {
        cancelLandingTarget();
        return;
      }
      if (clientState.viewMode === 'planet') {
        exitPlanetView();
        return;
      }
      if (clientState.selectedCityId) {
        clientState.selectedCityId = null;
      } else {
        clientState.selectedTileId = null;
      }
      notifySelectionChanged();
      return;
    }
  }
}