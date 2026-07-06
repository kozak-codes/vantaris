import * as THREE from 'three';
import { clientState } from '../state/ClientState';
import { onStateUpdate } from '../state/ClientState';
import { CFG, sampleWorldTerrain } from '@vantaris/shared';

const UNREVEALED_COLOR = new THREE.Color('#111111');

const TERRITORY_TINT_STRENGTH = 0.10;
const BORDER_PULSE_SPEED = 0.002;
const BORDER_PULSE_MIN = 0.5;
const BORDER_PULSE_MAX = 1.0;

export class FogRenderer {
  private cellMeshes: Map<string, THREE.Mesh>;
  private targetColors: Map<string, THREE.Color> = new Map();
  private ownerLines: THREE.LineSegments | null = null;
  private globe: THREE.Group;
  private grid: any;
  private lerpSpeed = 0.08;
  private animTime: number = 0;

  constructor(parent: THREE.Object3D, grid: any, cellMeshes: Map<number, THREE.Mesh>, globe: THREE.Group) {
    this.grid = grid;
    this.cellMeshes = new Map();
    this.globe = globe;

    for (const [id, mesh] of cellMeshes) {
      this.cellMeshes.set(`cell_${id}`, mesh);
    }

    onStateUpdate(() => this.onStateChange());
  }

  private onStateChange(): void {
    this.updateTargetColors();
    // Border lines are now drawn by SubHexWorldRenderer on the terrain surface.
    this.rebuildOwnerBorders();
  }

  private updateTargetColors(): void {
    const visibleSet = new Set<string>();
    const revealedSet = new Set<string>();

    for (const [cellId] of clientState.visibleCells) {
      visibleSet.add(cellId);
    }
    for (const [cellId] of clientState.revealedCells) {
      revealedSet.add(cellId);
    }

    for (const cell of this.grid.cells) {
      const key = `cell_${cell.id}`;
      let targetColor: THREE.Color;

      if (visibleSet.has(key)) {
        const data = clientState.visibleCells.get(key);
        if (data) {
          targetColor = new THREE.Color('#333333');
          if (data.ownerId && data.ownerId !== '') {
            const ownerPlayer = clientState.players.get(data.ownerId);
            if (ownerPlayer) {
              const ownerColor = new THREE.Color(ownerPlayer.color);
              targetColor.lerp(ownerColor, TERRITORY_TINT_STRENGTH);
            }
          }
        } else {
          targetColor = new THREE.Color('#333333');
        }
      } else if (revealedSet.has(key)) {
        targetColor = new THREE.Color('#1a1a2e');
      } else {
        targetColor = UNREVEALED_COLOR.clone();
      }

      this.targetColors.set(key, targetColor);
    }
  }

  updateFogColors(): void {
    this.animTime += 1;

    for (const cell of this.grid.cells) {
      const key = `cell_${cell.id}`;
      const mesh = this.cellMeshes.get(key);
      if (!mesh) continue;

      const target = this.targetColors.get(key);
      if (!target) continue;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.lerp(target, this.lerpSpeed);
    }

    if (this.ownerLines) {
      const pulse = BORDER_PULSE_MIN + (BORDER_PULSE_MAX - BORDER_PULSE_MIN) * (0.5 + 0.5 * Math.sin(this.animTime * BORDER_PULSE_SPEED));
      (this.ownerLines.material as THREE.LineBasicMaterial).opacity = pulse;
    }
  }

  forceColorUpdate(): void {
    this.updateTargetColors();
    for (const cell of this.grid.cells) {
      const key = `cell_${cell.id}`;
      const target = this.targetColors.get(key);
      const mesh = this.cellMeshes.get(key);
      if (target && mesh) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.copy(target);
      }
    }
  }

  private rebuildOwnerBorders(): void {
    if (this.ownerLines) {
      this.globe.remove(this.ownerLines);
      this.ownerLines.geometry.dispose();
      (this.ownerLines.material as THREE.Material).dispose();
      this.ownerLines = null;
    }

    const positions: number[] = [];
    const colors: number[] = [];
    const radius = CFG.GLOBE.radius;
    const seed = clientState.worldSeed;

    const sampleOnSurface = (v: [number, number, number]): THREE.Vector3 => {
      const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
      const sx = (v[0] / len) * radius;
      const sy = (v[1] / len) * radius;
      const sz = (v[2] / len) * radius;
      const { height } = sampleWorldTerrain([sx, sy, sz], seed);
      return new THREE.Vector3(sx, sy, sz).normalize().multiplyScalar(radius + height + 0.05);
    };

    const visibleSet = new Set<string>();
    for (const [cellId] of clientState.visibleCells) visibleSet.add(cellId);

    for (const cell of this.grid.cells) {
      const cellId = `cell_${cell.id}`;
      if (!visibleSet.has(cellId)) continue;

      const cellData = clientState.visibleCells.get(cellId);
      const ownerId = cellData?.ownerId || null;
      if (!ownerId) continue;

      const player = clientState.players.get(ownerId);
      const color = player ? new THREE.Color(player.color) : new THREE.Color('#888888');

      const neighbors = this.grid.adjacency.get(cell.id) || [];
      const hasDifferentNeighbor = neighbors.some((nId: number) => {
        const nData = clientState.visibleCells.get(`cell_${nId}`);
        return !nData || nData.ownerId !== ownerId;
      });

      if (!hasDifferentNeighbor) continue;

      const rawVerts = cell.vertexIds.map((fi: number) => this.grid.vertices[fi] as [number, number, number]);

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
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
          prev = next;
        }
      }
    }

    if (positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        linewidth: 2,
        depthTest: true,
      });
      this.ownerLines = new THREE.LineSegments(geom, mat);
      this.ownerLines.raycast = () => {};
      this.globe.add(this.ownerLines);
    }
  }

  getCellVisibility(cellId: string): string | null {
    if (clientState.visibleCells.has(cellId)) return 'VISIBLE';
    if (clientState.revealedCells.has(cellId)) return 'REVEALED';
    return null;
  }

  getCellMeshMap(): Map<string, THREE.Mesh> {
    return this.cellMeshes;
  }
}