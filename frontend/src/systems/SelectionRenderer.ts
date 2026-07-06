import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { GLOBE_RADIUS } from './IconFactory';

const SELECTION_OFFSET = 0.015;
const HOVER_OFFSET = 0.012;

const COLOR_HOVER = 0xffffff;

export class SelectionRenderer {
  private globe: THREE.Group;
  private grid: any;
  private hexRing: THREE.LineSegments | null = null;
  private hoverRing: THREE.LineSegments | null = null;
  private currentTileId: string | null = null;
  private currentHoveredCellId: string | null = null;

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

  private onStateChange(): void {
    const tileId = clientState.selectedTileId;
    const hoveredId = clientState.hoveredCellId;

    const tileChanged = tileId !== this.currentTileId;
    const hoverChanged = hoveredId !== this.currentHoveredCellId;

    this.currentTileId = tileId;
    this.currentHoveredCellId = hoveredId;

    if (tileChanged) {
      this.rebuildSelection();
    }

    if (hoverChanged) {
      this.rebuildHover();
    }
  }

  private rebuildSelection(): void {
    this.removeHexRing();

    if (!this.currentTileId) return;

    const ring = this.buildCellRing(this.currentTileId, 0xffff44, SELECTION_OFFSET);
    if (ring) this.hexRing = ring;
  }

  private rebuildHover(): void {
    this.removeHoverRing();

    if (!this.currentHoveredCellId) return;
    if (this.currentHoveredCellId === this.currentTileId) return;

    const visible = clientState.visibleCells.has(this.currentHoveredCellId);
    const revealed = clientState.revealedCells.has(this.currentHoveredCellId);
    if (!visible && !revealed) return;

    this.hoverRing = this.buildCellRing(this.currentHoveredCellId, COLOR_HOVER, HOVER_OFFSET);
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
    lineSegments.raycast = () => {};
    this.globe.add(lineSegments);
    return lineSegments;
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

  update(): void {
    if (this.hexRing) {
      const time = performance.now() * 0.003;
      (this.hexRing.material as THREE.LineBasicMaterial).opacity = 0.6 + 0.25 * Math.sin(time);
    }
  }
}