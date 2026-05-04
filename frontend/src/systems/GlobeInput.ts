import * as THREE from 'three';
import { clientState, notifySelectionChanged } from '../state/ClientState';
import { selectedBuildingId } from '../state/signals';
import type { CameraControls } from './CameraControls';

const CLICK_THRESHOLD_PX = 8;

export class GlobeInput {
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;
  private raycaster: THREE.Raycaster;
  private pointerDownPos: { x: number; y: number } | null = null;
  private pointerDownTime = 0;
  private globe: THREE.Group;
  private cameraControls: CameraControls | null = null;

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

  setCameraControls(cc: CameraControls): void {
    this.cameraControls = cc;
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

    const visibility = clientState.visibleCells.get(cellId);
    if (!visibility && !clientState.revealedCells.has(cellId)) {
      this.deselectAll();
      return;
    }

    const prevUnitId = clientState.selectedUnitId;
    const prevCityId = clientState.selectedCityId;

    if (cellId === clientState.selectedTileId && !prevUnitId && !prevCityId) {
      this.deselectAll();
      return;
    }

    if (cellId === clientState.selectedTileId && (prevUnitId || prevCityId)) {
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      clientState.pendingCommand = null;
      selectedBuildingId.value = null;
      notifySelectionChanged();
      return;
    }

    if (prevUnitId) {
      const unit = clientState.units.get(prevUnitId);
      if (unit && unit.cellId === cellId) {
        clientState.selectedTileId = cellId;
        notifySelectionChanged();
        return;
      }
    }
    if (prevCityId) {
      const city = clientState.cities.get(prevCityId);
      if (city && city.cellId === cellId) {
        clientState.selectedTileId = cellId;
        notifySelectionChanged();
        return;
      }
    }

    clientState.selectedTileId = cellId;
    clientState.selectedUnitId = null;
    clientState.selectedCityId = null;
    clientState.pendingCommand = null;
    selectedBuildingId.value = null;

    const unitsOnTile: string[] = [];
    for (const [unitId, unit] of clientState.units) {
      if (unit.cellId === cellId) unitsOnTile.push(unitId);
    }
    const citiesOnTile: string[] = [];
    for (const [cityId, city] of clientState.cities) {
      if (city.cellId === cellId) citiesOnTile.push(cityId);
    }

    if (unitsOnTile.length === 1 && citiesOnTile.length === 0) {
      clientState.selectedUnitId = unitsOnTile[0];
    } else if (citiesOnTile.length === 1 && unitsOnTile.length === 0) {
      clientState.selectedCityId = citiesOnTile[0];
    }

    notifySelectionChanged();
  }

  private deselectAll(): void {
    clientState.selectedTileId = null;
    clientState.selectedUnitId = null;
    clientState.selectedCityId = null;
    selectedBuildingId.value = null;
    clientState.pendingCommand = null;
    notifySelectionChanged();
  }

  private getCellIdFromIntersection(intersection: THREE.Intersection): string | null {
    if (!intersection.object || intersection.object.userData.cellId === undefined) return null;
    const numericId = intersection.object.userData.cellId as number;
    return `cell_${numericId}`;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (clientState.selectedUnitId) {
        clientState.selectedUnitId = null;
      } else if (clientState.selectedCityId) {
        clientState.selectedCityId = null;
      } else {
        clientState.selectedTileId = null;
      }
      clientState.pendingCommand = null;
      notifySelectionChanged();
      return;
    }
  }
}