import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { GLOBE_RADIUS } from './IconFactory';
import { PASSABLE_TERRAIN } from '@vantaris/shared/constants';
import { TerrainType } from '@vantaris/shared';

const SELECTION_OFFSET = 0.015;
const PATH_LINE_OFFSET = 1.02;
const HOVER_OFFSET = 0.012;

const COLOR_HOVER = 0xffffff;
const COLOR_MOVE_TARGET = 0xaa44ff;
const COLOR_CLAIM_TARGET = 0xffcc00;

export class SelectionRenderer {
  private globe: THREE.Group;
  private grid: any;
  private hexRing: THREE.LineSegments | null = null;
  private hoverRing: THREE.LineSegments | null = null;
  private pathLines: THREE.Line | null = null;
  private currentTileId: string | null = null;
  private currentUnitId: string | null = null;
  private currentCityId: string | null = null;
  private currentHoveredCellId: string | null = null;
  private currentPendingCommand: string | null = null;

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

  private cellCenterToWorld(cellId: string, offset: number = 1.01): THREE.Vector3 | null {
    const center = this.getCellCenter(cellId);
    if (!center) return null;
    return new THREE.Vector3(center[0], center[1], center[2]).normalize().multiplyScalar(GLOBE_RADIUS * offset);
  }

  private onStateChange(): void {
    const tileId = clientState.selectedTileId;
    const unitId = clientState.selectedUnitId;
    const cityId = clientState.selectedCityId;
    const hoveredId = clientState.hoveredCellId;
    const pendingCommand = clientState.pendingCommand;

    const tileChanged = tileId !== this.currentTileId;
    const unitChanged = unitId !== this.currentUnitId;
    const cityChanged = cityId !== this.currentCityId;
    const hoverChanged = hoveredId !== this.currentHoveredCellId;
    const commandChanged = pendingCommand !== this.currentPendingCommand;

    this.currentTileId = tileId;
    this.currentUnitId = unitId;
    this.currentCityId = cityId;
    this.currentHoveredCellId = hoveredId;
    this.currentPendingCommand = pendingCommand;

    if (tileChanged || unitChanged || cityChanged) {
      this.rebuild();
    } else {
      this.updatePathLines();
    }

    if (hoverChanged || commandChanged) {
      this.rebuildHover();
    }
  }

  private rebuild(): void {
    this.removeHexRing();
    this.removePathLines();

    if (!this.currentTileId) return;

    this.buildHexRing(this.currentTileId);
    this.buildPathLines();
  }

  private getHoverColor(): number {
    if (clientState.pendingCommand === 'move') return COLOR_MOVE_TARGET;
    if (clientState.pendingCommand === 'claim') return COLOR_CLAIM_TARGET;
    return COLOR_HOVER;
  }

  private rebuildHover(): void {
    this.removeHoverRing();

    if (!this.currentHoveredCellId) return;
    if (this.currentHoveredCellId === this.currentTileId) return;

    const visible = clientState.visibleCells.has(this.currentHoveredCellId);
    const revealed = clientState.revealedCells.has(this.currentHoveredCellId);
    if (!visible && !revealed) return;

    if (clientState.pendingCommand === 'move' && visible) {
      const cellData = clientState.visibleCells.get(this.currentHoveredCellId);
      if (cellData && !PASSABLE_TERRAIN.includes(cellData.biome as TerrainType)) {
        this.buildCellRing(this.currentHoveredCellId, 0xff4444, HOVER_OFFSET);
        return;
      }
    }

    this.buildCellRing(this.currentHoveredCellId, this.getHoverColor(), HOVER_OFFSET);
  }

  private buildHexRing(cellId: string): void {
    const ring = this.buildCellRing(cellId, 0xffff44, SELECTION_OFFSET);
    if (ring) this.hexRing = ring;
  }

  private buildCellRing(cellId: string, color: number, offset: number): THREE.LineSegments | null {
    const numericId = parseInt(cellId.replace('cell_', ''));
    if (isNaN(numericId) || numericId < 0 || numericId >= this.grid.cells.length) return null;

    const cell = this.grid.cells[numericId];
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
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const lineSegments = new THREE.LineSegments(geometry, material);
    this.globe.add(lineSegments);
    return lineSegments;
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

  private removeHexRing(): void {
    if (this.hexRing) {
      this.globe.remove(this.hexRing);
      this.hexRing.geometry.dispose();
      (this.hexRing.material as THREE.Material).dispose();
      this.hexRing = null;
    }
  }

  private removeHoverRing(): void {
    if (this.hoverRing) {
      this.globe.remove(this.hoverRing);
      this.hoverRing.geometry.dispose();
      (this.hoverRing.material as THREE.Material).dispose();
      this.hoverRing = null;
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