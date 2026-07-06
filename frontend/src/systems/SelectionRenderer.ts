import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { GLOBE_RADIUS } from './IconFactory';
import { sampleWorldTerrain } from '@vantaris/shared';

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

    const ring = this.buildCellRing(this.currentTileId, 0xffff44);
    if (ring) this.hexRing = ring;
  }

  private rebuildHover(): void {
    this.removeHoverRing();

    if (!this.currentHoveredCellId) return;
    if (this.currentHoveredCellId === this.currentTileId) return;

    const visible = clientState.visibleCells.has(this.currentHoveredCellId);
    const revealed = clientState.revealedCells.has(this.currentHoveredCellId);
    if (!visible && !revealed) return;

    this.hoverRing = this.buildCellRing(this.currentHoveredCellId, COLOR_HOVER);
  }

  private buildCellRing(cellId: string, color: number): THREE.LineSegments | null {
    const numericId = parseInt(cellId.replace('cell_', ''));
    if (isNaN(numericId) || numericId < 0 || numericId >= this.grid.cells.length) return null;

    const cell = this.grid.cells[numericId];
    const seed = clientState.worldSeed;

    const sampleOnSurface = (v: [number, number, number]): THREE.Vector3 => {
      const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
      const sx = (v[0] / len) * GLOBE_RADIUS;
      const sy = (v[1] / len) * GLOBE_RADIUS;
      const sz = (v[2] / len) * GLOBE_RADIUS;
      const { height } = sampleWorldTerrain([sx, sy, sz], seed);
      return new THREE.Vector3(sx, sy, sz).normalize().multiplyScalar(GLOBE_RADIUS + height + 0.05);
    };

    const rawVerts = cell.vertexIds.map((fi: number) => this.grid.vertices[fi] as [number, number, number]);
    const positions: number[] = [];

    for (let i = 0; i < rawVerts.length; i++) {
      const a = rawVerts[i];
      const b = rawVerts[(i + 1) % rawVerts.length];
      const STEPS = 8;
      let prev = sampleOnSurface(a);
      for (let s = 1; s <= STEPS; s++) {
        const t = s / STEPS;
        const mx = a[0] * (1 - t) + b[0] * t;
        const my = a[1] * (1 - t) + b[1] * t;
        const mz = a[2] * (1 - t) + b[2] * t;
        const next = sampleOnSurface([mx, my, mz]);
        positions.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
        prev = next;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: true });
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