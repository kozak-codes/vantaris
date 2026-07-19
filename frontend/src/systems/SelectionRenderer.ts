import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { GLOBE_RADIUS } from './IconFactory';
import { sampleWorldTerrain, CFG } from '@vantaris/shared';
import { landingTargetBodyId, orbitalBodies } from '../state/signals';

const COLOR_HOVER = 0xffffff;
const COLOR_LANDING_VALID = 0x44ff44;
const COLOR_LANDING_SUBPOINT = 0xffaa00;

export class SelectionRenderer {
  private globe: THREE.Group;
  private grid: any;
  private hexRing: THREE.LineSegments | null = null;
  private hoverRing: THREE.LineSegments | null = null;
  private landingRings: THREE.LineSegments[] = [];
  private currentTileId: string | null = null;
  private currentHoveredCellId: string | null = null;
  private currentLandingTargetBodyId: string | null = null;
  private currentLandingSubCellId: string | null = null;

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
    const landingBodyId = landingTargetBodyId.value;

    const tileChanged = tileId !== this.currentTileId;
    const hoverChanged = hoveredId !== this.currentHoveredCellId;
    const landingChanged = landingBodyId !== this.currentLandingTargetBodyId;

    this.currentTileId = tileId;
    this.currentHoveredCellId = hoveredId;
    this.currentLandingTargetBodyId = landingBodyId;

    if (tileChanged) {
      this.rebuildSelection();
    }

    if (hoverChanged) {
      this.rebuildHover();
    }

    if (landingChanged) {
      this.rebuildLandingHighlight();
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

  /**
   * Highlight every cell within `CFG.LANDING.wiggleCells` adjacency hops of
   * the lander's current sub-point, so the player can see which tiles are
   * valid landing targets. The sub-point itself is drawn in a different color.
   */
  private rebuildLandingHighlight(): void {
    this.removeLandingRings();
    if (!this.currentLandingTargetBodyId) {
      this.currentLandingSubCellId = null;
      return;
    }

    const body = orbitalBodies.value.get(this.currentLandingTargetBodyId);
    if (!body || body.type !== 'SPACECRAFT') return;
    if (body.landedCellId || body.descending) return;

    const subCellId = this.findCellBelowLander(body);
    this.currentLandingSubCellId = subCellId;
    if (!subCellId) return;

    // BFS from sub-point up to wiggleCells; collect all cell IDs in range.
    const subNumericId = parseInt(subCellId.replace('cell_', ''), 10);
    if (isNaN(subNumericId)) return;
    const wiggle = CFG.LANDING.wiggleCells;
    const inRange = new Set<number>([subNumericId]);
    let frontier = new Set<number>([subNumericId]);
    for (let i = 0; i < wiggle; i++) {
      const next = new Set<number>();
      for (const cid of frontier) {
        const neighbors = this.grid.adjacency.get(cid) ?? [];
        for (const nId of neighbors) {
          if (!inRange.has(nId)) {
            inRange.add(nId);
            next.add(nId);
          }
        }
      }
      frontier = next;
    }

    // Draw a ring around each cell in range.
    for (const cid of inRange) {
      const color = cid === subNumericId ? COLOR_LANDING_SUBPOINT : COLOR_LANDING_VALID;
      const ring = this.buildCellRing(`cell_${cid}`, color);
      if (ring) {
        if (ring.material instanceof THREE.LineBasicMaterial) {
          ring.material.opacity = cid === subNumericId ? 0.9 : 0.5;
        }
        this.landingRings.push(ring);
      }
    }
  }

  private removeLandingRings(): void {
    for (const ring of this.landingRings) {
      this.globe.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    }
    this.landingRings = [];
  }

  /** Find the globe cell directly below the lander (highest dot product). */
  private findCellBelowLander(body: { position: [number, number, number]; elements: { parent: string } }): string | null {
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

  update(): void {
    if (this.hexRing) {
      const time = performance.now() * 0.003;
      (this.hexRing.material as THREE.LineBasicMaterial).opacity = 0.6 + 0.25 * Math.sin(time);
    }
    // Landing highlight: rebuild only when the lander's sub-point cell has
    // moved to a different cell, so the rings track the ground track without
    // disposing/recreating geometries every frame.
    if (this.currentLandingTargetBodyId) {
      const body = orbitalBodies.value.get(this.currentLandingTargetBodyId);
      if (body && !body.landedCellId && !body.descending) {
        const subId = this.findCellBelowLander(body);
        if (subId !== this.currentLandingSubCellId) {
          this.currentLandingSubCellId = subId;
          this.rebuildLandingHighlight();
        }
      }
    }
  }
}