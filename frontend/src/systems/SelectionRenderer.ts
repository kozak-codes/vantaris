import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import type { CityData } from '@vantaris/shared';
import { createCityIcon, createInfantryIcon, positionOnSurface, offsetOnSurface, orientToSurface, GLOBE_RADIUS } from './IconFactory';

const SELECTION_OFFSET = 1.01;
const PATH_LINE_OFFSET = 1.02;
const ENTITY_RING_OFFSET = 1.06;

export class SelectionRenderer {
  private globe: THREE.Group;
  private grid: any;
  private hexRing: THREE.LineSegments | null = null;
  private cityIndicator: THREE.Mesh | null = null;
  private unitIndicator: THREE.Mesh | null = null;
  private pathLines: THREE.Line | null = null;
  private currentTileId: string | null = null;
  private currentUnitId: string | null = null;
  private currentCityId: string | null = null;

  constructor(globe: THREE.Group, grid: any) {
    this.globe = globe;
    this.grid = grid;

    onStateUpdate(() => this.onStateChange());
  }

  private getCellCenter(cellId: string): [number, number, number] | null {
    const numericId = parseInt(cellId.replace('cell_', ''));
    if (isNaN(numericId) || numericId < 0 || numericId >= this.grid.cells.length) return null;
    return this.grid.cells[numericId].center;
  }

  private cellCenterToWorld(cellId: string, offset: number = SELECTION_OFFSET): THREE.Vector3 | null {
    const center = this.getCellCenter(cellId);
    if (!center) return null;
    return new THREE.Vector3(center[0], center[1], center[2]).normalize().multiplyScalar(GLOBE_RADIUS * offset);
  }

  private onStateChange(): void {
    const tileId = clientState.selectedTileId;
    const unitId = clientState.selectedUnitId;
    const cityId = clientState.selectedCityId;

    const tileChanged = tileId !== this.currentTileId;
    const unitChanged = unitId !== this.currentUnitId;
    const cityChanged = cityId !== this.currentCityId;

    this.currentTileId = tileId;
    this.currentUnitId = unitId;
    this.currentCityId = cityId;

    if (tileChanged) {
      this.rebuild();
    } else {
      if (unitChanged) this.updateUnitIndicator();
      if (cityChanged) this.updateCityIndicator();
      this.updatePathLines();
    }
  }

  private rebuild(): void {
    this.removeHexRing();
    this.removeUnitIndicator();
    this.removeCityIndicator();
    this.removePathLines();

    if (!this.currentTileId) return;

    this.buildHexRing(this.currentTileId);
    this.buildUnitIndicator();
    this.buildCityIndicator();
    this.buildPathLines();
  }

  private buildHexRing(cellId: string): void {
    const numericId = parseInt(cellId.replace('cell_', ''));
    if (isNaN(numericId) || numericId < 0 || numericId >= this.grid.cells.length) return;

    const cell = this.grid.cells[numericId];
    const offset = 0.015;

    const verts = cell.vertexIds.map((fi: number) => {
      const dv = this.grid.vertices[fi];
      return new THREE.Vector3(dv[0], dv[1], dv[2]).normalize().multiplyScalar(GLOBE_RADIUS + offset);
    });

    const positions: number[] = [];
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xffff44,
      transparent: true,
      opacity: 0.85,
    });
    this.hexRing = new THREE.LineSegments(geometry, material);
    this.globe.add(this.hexRing);
  }

  private buildUnitIndicator(): void {
    this.removeUnitIndicator();
    if (!this.currentTileId || !this.currentUnitId) return;

    const unit = clientState.units.get(this.currentUnitId);
    if (!unit) return;

    const player = clientState.players.get(unit.ownerId);
    const color = player ? player.color : '#ffffff';

    const center = this.getCellCenter(this.currentTileId);
    if (!center) return;

    this.unitIndicator = createInfantryIcon(color);
    const basePos = new THREE.Vector3(center[0], center[1], center[2]).normalize().multiplyScalar(GLOBE_RADIUS * ENTITY_RING_OFFSET);
    this.unitIndicator.position.copy(basePos);
    orientToSurface(this.unitIndicator, basePos);
    this.unitIndicator.scale.set(1.5, 1.5, 1.5);
    this.globe.add(this.unitIndicator);
  }

  private updateUnitIndicator(): void {
    this.buildUnitIndicator();
  }

  private buildCityIndicator(): void {
    this.removeCityIndicator();
    if (!this.currentTileId || !this.currentCityId) return;

    const city = clientState.cities.get(this.currentCityId);
    if (!city) return;

    const player = clientState.players.get(city.ownerId);
    const color = player ? player.color : '#ffffff';

    const center = this.getCellCenter(this.currentTileId);
    if (!center) return;

    this.cityIndicator = createCityIcon(color, city.tier);
    const basePos = new THREE.Vector3(center[0], center[1], center[2]).normalize().multiplyScalar(GLOBE_RADIUS * ENTITY_RING_OFFSET);
    this.cityIndicator.position.copy(basePos);
    orientToSurface(this.cityIndicator, basePos);
    const offsetPos = offsetOnSurface(basePos, 0.15, -0.15);
    this.cityIndicator.position.copy(offsetPos);
    orientToSurface(this.cityIndicator, offsetPos);
    this.globe.add(this.cityIndicator);
  }

  private updateCityIndicator(): void {
    this.buildCityIndicator();
  }

  private buildPathLines(): void {
    this.removePathLines();

    if (!this.currentUnitId) return;

    const unit = clientState.units.get(this.currentUnitId);
    if (!unit || unit.status !== 'MOVING' || !unit.path || unit.path.length === 0) return;

    const points: THREE.Vector3[] = [];

    const startWorld = this.cellCenterToWorld(unit.cellId, PATH_LINE_OFFSET);
    if (startWorld) points.push(startWorld);

    for (const cid of unit.path) {
      const pos = this.cellCenterToWorld(cid, PATH_LINE_OFFSET);
      if (pos) points.push(pos);
    }

    if (points.length < 2) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x44ddff,
      transparent: true,
      opacity: 0.7,
      linewidth: 2,
    });
    this.pathLines = new THREE.Line(geometry, material);
    this.globe.add(this.pathLines);
  }

  private updatePathLines(): void {
    this.buildPathLines();
  }

  private findCityOnCell(cellId: string): CityData | null {
    for (const [, city] of clientState.cities) {
      if (city.cellId === cellId) return city;
    }
    return null;
  }

  private removeHexRing(): void {
    if (this.hexRing) {
      this.globe.remove(this.hexRing);
      this.hexRing.geometry.dispose();
      (this.hexRing.material as THREE.Material).dispose();
      this.hexRing = null;
    }
  }

  private removeUnitIndicator(): void {
    if (this.unitIndicator) {
      this.globe.remove(this.unitIndicator);
      this.unitIndicator.geometry.dispose();
      (this.unitIndicator.material as THREE.Material).dispose();
      this.unitIndicator = null;
    }
  }

  private removeCityIndicator(): void {
    if (this.cityIndicator) {
      this.globe.remove(this.cityIndicator);
      this.cityIndicator.geometry.dispose();
      (this.cityIndicator.material as THREE.Material).dispose();
      this.cityIndicator = null;
    }
  }

  private removePathLines(): void {
    if (this.pathLines) {
      this.globe.remove(this.pathLines);
      this.pathLines.geometry.dispose();
      (this.pathLines.material as THREE.Material).dispose();
      this.pathLines = null;
    }
  }

  update(): void {
    if (this.hexRing) {
      const time = performance.now() * 0.003;
      (this.hexRing.material as THREE.LineBasicMaterial).opacity = 0.6 + 0.25 * Math.sin(time);
    }
  }
}