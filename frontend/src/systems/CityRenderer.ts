import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { createCityIcon, positionOnSurface, orientToSurface, GLOBE_RADIUS } from './IconFactory';

const CITY_SURFACE_OFFSET = 1.01;

interface CityVisual {
  icon: THREE.Mesh;
  cellId: string;
  tier: number;
  ownerId: string;
}

export class CityRenderer {
  private globe: THREE.Group;
  private grid: any;
  private cityVisuals: Map<string, CityVisual> = new Map();

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
    const currentCityIds = new Set<string>();

    for (const [cityId, city] of clientState.cities) {
      if (!clientState.visibleCells.has(city.cellId)) continue;
      currentCityIds.add(cityId);

      const player = clientState.players.get(city.ownerId);
      const color = player ? player.color : '#ffffff';

      if (this.cityVisuals.has(cityId)) {
        const cv = this.cityVisuals.get(cityId)!;
        cv.tier = city.tier;
        cv.ownerId = city.ownerId;

        this.globe.remove(cv.icon);
        cv.icon.geometry.dispose();
        (cv.icon.material as THREE.Material).dispose();

        const newIcon = createCityIcon(color, city.tier);
        const center = this.getCellCenter(city.cellId);
        if (center) {
          positionOnSurface(newIcon, center, CITY_SURFACE_OFFSET);
        }
        newIcon.userData = { cityId, type: 'city' };
        this.globe.add(newIcon);

        cv.icon = newIcon;
      } else {
        const icon = createCityIcon(color, city.tier);
        icon.userData = { cityId, type: 'city' };

        const center = this.getCellCenter(city.cellId);
        if (center) {
          positionOnSurface(icon, center, CITY_SURFACE_OFFSET);
        }

        this.globe.add(icon);
        this.cityVisuals.set(cityId, {
          icon,
          cellId: city.cellId,
          tier: city.tier,
          ownerId: city.ownerId,
        });
      }
    }

    for (const [cityId, cv] of this.cityVisuals) {
      if (!currentCityIds.has(cityId)) {
        this.globe.remove(cv.icon);
        cv.icon.geometry.dispose();
        (cv.icon.material as THREE.Material).dispose();
        this.cityVisuals.delete(cityId);
      }
    }
  }

  getMeshes(): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    for (const [, cv] of this.cityVisuals) {
      objects.push(cv.icon);
    }
    return objects;
  }

  getCityIdAtIntersection(intersection: THREE.Intersection): string | null {
    if (!intersection.object) return null;
    return intersection.object.userData?.cityId ?? null;
  }
}