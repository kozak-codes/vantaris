import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { GLOBE_RADIUS, orientToSurface, offsetOnSurface } from './IconFactory';

const BUILDING_OFFSET = 1.02;

const BUILDING_COLORS: Record<string, string> = {
  FARM: '#55aa44',
  MINE: '#aa8844',
  OIL_WELL: '#4488cc',
  LUMBER_CAMP: '#7a9944',
  FACTORY: '#cc8844',
};

const BUILDING_LABELS: Record<string, string> = {
  FARM: '🌾',
  MINE: '⛏',
  OIL_WELL: '🛢',
  LUMBER_CAMP: '🪵',
  FACTORY: '🏭',
};

const MAX_ICONS_PER_CELL = 3;
const ICON_SPACING = 0.12;
const ICON_SIZE = 0.2;

interface BuildingVisual {
  icon: THREE.Mesh;
  cellId: string;
  type: string;
  underConstruction: boolean;
}

export class BuildingRenderer {
  private globe: THREE.Group;
  private grid: any;
  private buildingVisuals: Map<string, BuildingVisual> = new Map();

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

  private getIconOffset(buildingId: string, cellId: string): { dx: number; dy: number } {
    const buildingsOnCell: string[] = [];
    for (const [bid, b] of clientState.buildings) {
      if (b.cellId === cellId) buildingsOnCell.push(bid);
    }
    const idx = buildingsOnCell.indexOf(buildingId);
    if (idx < 0 || buildingsOnCell.length <= 1) return { dx: 0, dy: 0 };

    const count = Math.min(buildingsOnCell.length, MAX_ICONS_PER_CELL);
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const ox = (col - (count > 1 ? 0.5 : 0)) * ICON_SPACING;
    const oy = (row - 0.5) * ICON_SPACING;
    return { dx: ox, dy: oy };
  }

  private positionBuilding(icon: THREE.Mesh, buildingId: string, cellId: string): void {
    const center = this.getCellCenter(cellId);
    if (!center) return;
    const basePos = new THREE.Vector3(center[0], center[1], center[2]).normalize().multiplyScalar(GLOBE_RADIUS * BUILDING_OFFSET);
    const offset = this.getIconOffset(buildingId, cellId);
    if (offset.dx !== 0 || offset.dy !== 0) {
      const offsetPos = offsetOnSurface(basePos, offset.dx, offset.dy);
      icon.position.copy(offsetPos);
      orientToSurface(icon, offsetPos);
    } else {
      icon.position.copy(basePos);
      orientToSurface(icon, basePos);
    }
  }

  private onStateChange(): void {
    const currentBuildingIds = new Set<string>();

    for (const [buildingId, building] of clientState.buildings) {
      if (!clientState.visibleCells.has(building.cellId)) continue;
      currentBuildingIds.add(buildingId);

      const underConstruction = building.productionTicksRemaining > 0;

      if (this.buildingVisuals.has(buildingId)) {
        const bv = this.buildingVisuals.get(buildingId)!;
        if (bv.type === building.type && bv.underConstruction === underConstruction) {
          this.positionBuilding(bv.icon, buildingId, building.cellId);
          continue;
        }

        this.globe.remove(bv.icon);
        bv.icon.geometry.dispose();
        (bv.icon.material as THREE.Material).dispose();
        if ((bv.icon.material as THREE.MeshBasicMaterial).map) {
          ((bv.icon.material as THREE.MeshBasicMaterial).map!).dispose();
        }

        const newIcon = this.createBuildingIcon(building.type, underConstruction);
        this.positionBuilding(newIcon, buildingId, building.cellId);
        newIcon.userData = { buildingId, type: 'building' };
        this.globe.add(newIcon);

        bv.icon = newIcon;
        bv.type = building.type;
        bv.underConstruction = underConstruction;
      } else {
        const icon = this.createBuildingIcon(building.type, underConstruction);
        icon.userData = { buildingId, type: 'building' };

        this.positionBuilding(icon, buildingId, building.cellId);

        this.globe.add(icon);
        this.buildingVisuals.set(buildingId, {
          icon,
          cellId: building.cellId,
          type: building.type,
          underConstruction,
        });
      }
    }

    for (const [buildingId, bv] of this.buildingVisuals) {
      if (!currentBuildingIds.has(buildingId)) {
        this.globe.remove(bv.icon);
        bv.icon.geometry.dispose();
        if ((bv.icon.material as THREE.MeshBasicMaterial).map) {
          ((bv.icon.material as THREE.MeshBasicMaterial).map!).dispose();
        }
        (bv.icon.material as THREE.Material).dispose();
        this.buildingVisuals.delete(buildingId);
      }
    }
  }

  private createBuildingIcon(buildingType: string, underConstruction: boolean): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const color = BUILDING_COLORS[buildingType] || '#888888';
    const label = BUILDING_LABELS[buildingType] || '?';

    if (underConstruction) {
      ctx.globalAlpha = 0.5;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(32, 32, 14, 0, Math.PI * 2);
    ctx.fill();

    if (!underConstruction) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = underConstruction ? 'rgba(255,255,255,0.6)' : '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 32, 34);

    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.PlaneGeometry(ICON_SIZE, ICON_SIZE);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 997;
    mesh.raycast = () => {};
    return mesh;
  }

  update(): void {}

  getMeshes(): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    for (const [, bv] of this.buildingVisuals) {
      objects.push(bv.icon);
    }
    return objects;
  }
}