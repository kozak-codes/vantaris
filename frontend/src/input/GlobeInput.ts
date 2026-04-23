import * as THREE from 'three';
import { clientState, notifySelectionChanged } from '../state/ClientState';
import { sendMoveUnit, sendClaimTerritory } from '../network/ColyseusClient';
import { TerrainType } from '@vantaris/shared';
import { PASSABLE_TERRAIN } from '@vantaris/shared/constants';

const CLICK_THRESHOLD_PX = 5;

export class GlobeInput {
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;
  private raycaster: THREE.Raycaster;
  private pointerDownPos: { x: number; y: number } | null = null;
  private globe: THREE.Group;

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
    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button !== 0 || !this.pointerDownPos) return;

    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    this.pointerDownPos = null;

    if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD_PX) return;

    this.handleClick(e.shiftKey, e.clientX, e.clientY);
  }

  private handleClick(shiftHeld: boolean, clientX: number, clientY: number): void {
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

    const prevTileId = clientState.selectedTileId;
    const prevUnitId = clientState.selectedUnitId;
    const pendingCommand = clientState.pendingCommand;

    if (pendingCommand === 'move' && prevUnitId) {
      const unit = clientState.units.get(prevUnitId);
      if (unit && unit.status === 'IDLE' && unit.ownerId === clientState.myPlayerId && visibility) {
        if (PASSABLE_TERRAIN.includes(visibility.biome as TerrainType)) {
          sendMoveUnit(prevUnitId, cellId);
          if (shiftHeld) {
            clientState.commandQueue.push({
              entityId: prevUnitId,
              entityType: 'unit',
              action: 'claim',
              target: cellId,
            });
          }
          clientState.pendingCommand = null;
          clientState.selectedTileId = cellId;
          clientState.selectedCityId = null;
          notifySelectionChanged();
          return;
        }
      }
    }

    if (cellId === prevTileId) {
      clientState.selectedTileId = null;
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      clientState.pendingCommand = null;
      notifySelectionChanged();
      return;
    }

    clientState.selectedTileId = cellId;
    clientState.selectedUnitId = null;
    clientState.selectedCityId = null;
    clientState.pendingCommand = null;
    notifySelectionChanged();
  }

  private deselectAll(): void {
    clientState.selectedTileId = null;
    clientState.selectedUnitId = null;
    clientState.selectedCityId = null;
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
      if (clientState.pendingCommand) {
        clientState.pendingCommand = null;
      } else if (clientState.selectedUnitId) {
        clientState.selectedUnitId = null;
      } else if (clientState.selectedCityId) {
        clientState.selectedCityId = null;
      } else {
        clientState.selectedTileId = null;
      }
      notifySelectionChanged();
      return;
    }

    if (e.key === '1' || e.key === 'm' || e.key === 'M') {
      this.handleMoveKey(e.shiftKey);
    }

    if (e.key === '2' || e.key === 'c' || e.key === 'C') {
      this.handleClaimKey();
    }
  }

  private handleMoveKey(shiftHeld: boolean): void {
    const unitId = clientState.selectedUnitId;
    if (!unitId) return;
    const unit = clientState.units.get(unitId);
    if (!unit || unit.status !== 'IDLE' || unit.ownerId !== clientState.myPlayerId) return;

    clientState.pendingCommand = 'move';
    notifySelectionChanged();
  }

  private handleClaimKey(): void {
    const unitId = clientState.selectedUnitId;
    if (!unitId) return;
    const unit = clientState.units.get(unitId);
    if (!unit || unit.status !== 'IDLE' || unit.ownerId !== clientState.myPlayerId) return;

    sendClaimTerritory(unitId);
    clientState.pendingCommand = null;
    notifySelectionChanged();
  }
}