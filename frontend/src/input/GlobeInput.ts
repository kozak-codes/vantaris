import * as THREE from 'three';
import { clientState, notifySelectionChanged } from '../state/ClientState';
import { sendMoveUnit, sendSetUnitIdle } from '../network/ColyseusClient';
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

    this.handleClick(e);
  }

  private handleClick(e: PointerEvent): void {
    const pointer = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
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
      clientState.selectedTileId = null;
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      notifySelectionChanged();
      return;
    }

    const cellId = this.getCellIdFromIntersection(hexIntersects[0]);
    if (!cellId) {
      clientState.selectedTileId = null;
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      notifySelectionChanged();
      return;
    }

    const visibility = clientState.visibleCells.get(cellId);
    if (!visibility && !clientState.revealedCells.has(cellId)) {
      clientState.selectedTileId = null;
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      notifySelectionChanged();
      return;
    }

    const prevTileId = clientState.selectedTileId;
    const prevUnitId = clientState.selectedUnitId;

    if (prevTileId === cellId && prevUnitId) {
      const myUnitsOnTarget = this.getMyIdleUnitsOnTile(cellId);
      if (myUnitsOnTarget.length > 0 && visibility) {
        if (PASSABLE_TERRAIN.includes(visibility.biome as TerrainType)) {
          sendMoveUnit(prevUnitId, cellId);
          clientState.selectedTileId = null;
          clientState.selectedUnitId = null;
          clientState.selectedCityId = null;
          notifySelectionChanged();
          return;
        }
      }
    }

    if (prevTileId && prevTileId !== cellId && prevUnitId) {
      const myUnitsOnPrev = this.getMyIdleUnitsOnTile(prevTileId);
      const unitStillOnTile = myUnitsOnPrev.find(uid => uid === prevUnitId);
      if (unitStillOnTile && visibility) {
        if (PASSABLE_TERRAIN.includes(visibility.biome as TerrainType)) {
          sendMoveUnit(prevUnitId, cellId);
          clientState.selectedTileId = null;
          clientState.selectedUnitId = null;
          clientState.selectedCityId = null;
          notifySelectionChanged();
          return;
        }
      }
    }

    clientState.selectedTileId = cellId;

    const unitsOnTile = this.getUnitsOnTile(cellId);
    if (unitsOnTile.length > 0) {
      const myUnits = unitsOnTile.filter(uid => {
        const u = clientState.units.get(uid);
        return u && u.ownerId === clientState.myPlayerId;
      });
      clientState.selectedUnitId = myUnits[0] || unitsOnTile[0];
    } else {
      clientState.selectedUnitId = null;
    }

    const cityOnTile = this.getCityOnTile(cellId);
    clientState.selectedCityId = cityOnTile;
    notifySelectionChanged();
  }

  private getUnitsOnTile(tileId: string): string[] {
    const result: string[] = [];
    for (const [unitId, unit] of clientState.units) {
      if (unit.cellId === tileId) {
        result.push(unitId);
      }
    }
    return result;
  }

  private getMyIdleUnitsOnTile(tileId: string): string[] {
    const result: string[] = [];
    for (const [unitId, unit] of clientState.units) {
      if (unit.cellId === tileId && unit.ownerId === clientState.myPlayerId && unit.status === 'IDLE') {
        result.push(unitId);
      }
    }
    return result;
  }

  private getCityOnTile(tileId: string): string | null {
    for (const [cityId, city] of clientState.cities) {
      if (city.cellId === tileId) return cityId;
    }
    return null;
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
      notifySelectionChanged();
    }
  }
}