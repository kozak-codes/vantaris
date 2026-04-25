import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { GLOBE_RADIUS, orientToSurface } from './IconFactory';
import { RuinType } from '@vantaris/shared';

const RUIN_OFFSET = 1.012;

const RUIN_LABELS: Record<string, string> = {
  RUINED_CITY: 'RC',
  RUINED_FACTORY: 'RF',
  RUINED_PORT: 'RP',
  RUINED_BARRACKS: 'RB',
  COLLAPSED_MINE: 'CM',
  OVERGROWN_FARM: 'OF',
};

export class RuinRenderer {
  private globe: THREE.Group;
  private grid: any;
  private markers: THREE.Group = new THREE.Group();
  private currentMarkerSet = new Set<string>();

  constructor(globe: THREE.Group, grid: any) {
    this.globe = globe;
    this.grid = grid;
    this.markers.name = 'ruin-markers';
    this.globe.add(this.markers);

    onStateUpdate(() => this.rebuild());
  }

  private rebuild(): void {
    const nextSet = new Set<string>();

    for (const [cellId] of clientState.ruinMarkers) {
      const visible = clientState.visibleCells.has(cellId);
      if (visible) continue;
      nextSet.add(cellId);
    }

    for (const [cellId] of clientState.visibleCells) {
      const cellData = clientState.visibleCells.get(cellId);
      if (cellData && cellData.ruin) {
        nextSet.add(cellId + ':detail');
      }
    }

    if (this.setsEqual(nextSet, this.currentMarkerSet)) return;

    this.clearMarkers();
    this.currentMarkerSet = nextSet;

    for (const key of nextSet) {
      if (key.endsWith(':detail')) {
        const cellId = key.replace(':detail', '');
        const cellData = clientState.visibleCells.get(cellId);
        if (cellData && cellData.ruin) {
          this.addMarker(cellId, cellData.ruin, cellData.ruinRevealed);
        }
      } else {
        const data = clientState.ruinMarkers.get(key);
        if (data) {
          this.addMarker(key, data.ruin, false);
        }
      }
    }
  }

  private addMarker(cellId: string, ruin: string, revealed: boolean): void {
    const numericId = parseInt(cellId.replace('cell_', ''));
    if (isNaN(numericId) || numericId < 0 || numericId >= this.grid.cells.length) return;

    const cell = this.grid.cells[numericId];
    const center = cell.center as [number, number, number];
    const pos = new THREE.Vector3(center[0], center[1], center[2]).normalize().multiplyScalar(GLOBE_RADIUS * RUIN_OFFSET);
    const label = RUIN_LABELS[ruin] || '??';

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    if (!revealed) {
      ctx.fillStyle = 'rgba(80,60,30,0.8)';
      ctx.beginPath();
      ctx.arc(32, 32, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,150,80,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(200,170,68,0.9)';
      ctx.beginPath();
      ctx.arc(32, 32, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,100,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#222';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 32, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.PlaneGeometry(0.22, 0.22);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pos);
    orientToSurface(mesh, pos);
    mesh.raycast = () => {};
    this.markers.add(mesh);
  }

  private clearMarkers(): void {
    while (this.markers.children.length > 0) {
      const child = this.markers.children[0];
      this.markers.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          if ((child.material as THREE.MeshBasicMaterial).map) {
            (child.material as THREE.MeshBasicMaterial).map!.dispose();
          }
          child.material.dispose();
        }
      }
    }
  }

  private setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }

  update(): void {}
}