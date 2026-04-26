import * as THREE from 'three';
import { clientState } from '../state/ClientState';
import { onStateUpdate } from '../state/ClientState';
import { TerrainType } from '../types/index';
import { TERRAIN_CONFIGS } from '../constants';

const biomeColorMap = new Map<string, THREE.Color>(
  (Object.entries(TERRAIN_CONFIGS) as [string, { color: string }][]).map(([key, val]) => [key, new THREE.Color(val.color)]),
);

const VISIBLE_COLOR_FACTOR = 1.0;
const REVEALED_COLOR_FACTOR = 0.25;
const UNREVEALED_COLOR = new THREE.Color('#111111');

const TERRITORY_TINT_STRENGTH = 0.10;
const BORDER_PULSE_SPEED = 0.002;
const BORDER_PULSE_MIN = 0.5;
const BORDER_PULSE_MAX = 1.0;

export class FogRenderer {
  private cellMeshes: Map<string, THREE.Mesh>;
  private targetColors: Map<string, THREE.Color> = new Map();
  private borderLines: THREE.LineSegments | null = null;
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

    this.rebuildBorders();
  }

  private onStateChange(): void {
    this.updateTargetColors();
    this.rebuildBorders();
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
          const biomeColor = biomeColorMap.get(data.biome);
          targetColor = biomeColor ? biomeColor.clone() : new THREE.Color('#333333');
          if (data.ownerId && data.ownerId !== '') {
            const ownerPlayer = clientState.players.get(data.ownerId);
            if (ownerPlayer) {
              const ownerColor = new THREE.Color(ownerPlayer.color);
              targetColor.lerp(ownerColor, TERRITORY_TINT_STRENGTH);
            }
          }
        } else {
          targetColor = biomeColorMap.get(cell.biome)!.clone();
        }
      } else if (revealedSet.has(key)) {
        const data = clientState.revealedCells.get(key);
        const biome = data?.lastKnownBiome || cell.biome;
        const biomeColor = biomeColorMap.get(biome);
        if (biomeColor) {
          targetColor = biomeColor.clone().lerp(UNREVEALED_COLOR, 0.7);
        } else {
          targetColor = new THREE.Color('#1a1a2e');
        }
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

  private rebuildBorders(): void {
    if (this.borderLines) {
      this.globe.remove(this.borderLines);
      this.borderLines.geometry.dispose();
      (this.borderLines.material as THREE.Material).dispose();
      this.borderLines = null;
    }

    const positions: number[] = [];
    const offset = 0.005;
    const radius = 5;
    const visibleSet = new Set<string>();
    const revealedSet = new Set<string>();
    for (const [cellId] of clientState.visibleCells) visibleSet.add(cellId);
    for (const [cellId] of clientState.revealedCells) revealedSet.add(cellId);

    for (const cell of this.grid.cells) {
      const key = `cell_${cell.id}`;
      if (!visibleSet.has(key) && !revealedSet.has(key)) continue;

      const center = new THREE.Vector3(cell.center[0], cell.center[1], cell.center[2]);
      const cn = center.clone().normalize();

      const dualVerts = cell.vertexIds.map((fi: number) => {
        const dv = this.grid.vertices[fi];
        return new THREE.Vector3(dv[0], dv[1], dv[2]);
      });

      for (let i = 0; i < dualVerts.length; i++) {
        const a = dualVerts[i];
        const b = dualVerts[(i + 1) % dualVerts.length];
        const an = a.clone().normalize().multiplyScalar(radius + offset);
        const bn = b.clone().normalize().multiplyScalar(radius + offset);
        positions.push(an.x, an.y, an.z, bn.x, bn.y, bn.z);
      }
    }

    if (positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.4,
      });
      this.borderLines = new THREE.LineSegments(geom, mat);
      this.borderLines.raycast = () => {};
      this.globe.add(this.borderLines);
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
    const offset = 0.016;
    const radius = 5;

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

      const dualVerts = cell.vertexIds.map((fi: number) => {
        const dv = this.grid.vertices[fi];
        return new THREE.Vector3(dv[0], dv[1], dv[2]);
      });

      for (let i = 0; i < dualVerts.length; i++) {
        const a = dualVerts[i].clone().normalize().multiplyScalar(radius + offset);
        const b = dualVerts[(i + 1) % dualVerts.length].clone().normalize().multiplyScalar(radius + offset);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
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