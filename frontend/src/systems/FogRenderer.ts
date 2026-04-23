import * as THREE from 'three';
import { clientState } from '../state/ClientState';
import { onStateUpdate } from '../state/ClientState';
import { BiomeType } from '../types/index';
import { BIOME_CONFIGS } from '../constants';

const biomeColorMap = new Map<string, THREE.Color>(
  BIOME_CONFIGS.map(b => [b.type, new THREE.Color(b.color)]),
);

const VISIBLE_COLOR_FACTOR = 1.0;
const REVEALED_COLOR_FACTOR = 0.25;
const UNREVEALED_COLOR = new THREE.Color('#111111');

export class FogRenderer {
  private cellMeshes: Map<string, THREE.Mesh>;
  private targetColors: Map<string, THREE.Color> = new Map();
  private borderLines: THREE.LineSegments | null = null;
  private globe: THREE.Group;
  private grid: any;
  private lerpSpeed = 0.08;

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
    for (const cell of this.grid.cells) {
      const key = `cell_${cell.id}`;
      const mesh = this.cellMeshes.get(key);
      if (!mesh) continue;

      const target = this.targetColors.get(key);
      if (!target) continue;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.lerp(target, this.lerpSpeed);
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

  getCellVisibility(cellId: string): string | null {
    if (clientState.visibleCells.has(cellId)) return 'VISIBLE';
    if (clientState.revealedCells.has(cellId)) return 'REVEALED';
    return null;
  }
}