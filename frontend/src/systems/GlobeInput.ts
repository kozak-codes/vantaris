import * as THREE from 'three';
import { clientState, notifySelectionChanged } from '../state/ClientState';
import { sendMoveUnit, sendClaimTerritory, sendBuildStructure } from '../network/ColyseusClient';
import { selectedBuildingId } from '../state/signals';
import {
  TerrainType,
  CFG,
  getPassableTerrain,
  getBuildingCosts,
  getBuildingPlacementRules,
  getEngineerBuildableTypes,
  getInfantryBuildableTypes,
} from '@vantaris/shared';

const PASSABLE_TERRAIN = getPassableTerrain(CFG);
const BUILDING_COSTS = getBuildingCosts(CFG);
const BUILDING_PLACEMENT_RULES = getBuildingPlacementRules(CFG);

const CLICK_THRESHOLD_PX = 5;

export class GlobeInput {
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;
  private raycaster: THREE.Raycaster;
  private pointerDownPos: { x: number; y: number } | null = null;
  private globe: THREE.Group;

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.PerspectiveCamera,
    globe: THREE.Group,
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.globe = globe;
    this.raycaster = new THREE.Raycaster();

    canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    canvas.addEventListener('pointerleave', this.clearHover.bind(this));
    canvas.addEventListener('pointerout', this.clearHover.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button !== 0 || !this.pointerDownPos) return;

    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    this.pointerDownPos = null;

    if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD_PX) return;

    this.handleClick(e.clientX, e.clientY);
  }

  private onPointerMove(e: PointerEvent): void {
    clientState.mouseClientX = e.clientX;
    clientState.mouseClientY = e.clientY;

    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      (2 * (e.clientX - rect.left) / rect.width) - 1,
      -(2 * (e.clientY - rect.top) / rect.height) + 1,
    );

    this.raycaster.setFromCamera(pointer, this.camera);

    const hexMeshes: THREE.Object3D[] = [];
    this.globe.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.cellId !== undefined) {
        hexMeshes.push(child);
      }
    });

    const hexIntersects = this.raycaster.intersectObjects(hexMeshes, false);
    if (hexIntersects.length === 0) {
      if (clientState.hoveredCellId !== null) {
        clientState.hoveredCellId = null;
        notifySelectionChanged();
      }
      return;
    }

    const cellId = this.getCellIdFromIntersection(hexIntersects[0]);
    if (!cellId) {
      if (clientState.hoveredCellId !== null) {
        clientState.hoveredCellId = null;
        notifySelectionChanged();
      }
      return;
    }

    const visibility = clientState.visibleCells.get(cellId);
    const revealed = clientState.revealedCells.has(cellId);
    if (!visibility && !revealed) {
      if (clientState.hoveredCellId !== null) {
        clientState.hoveredCellId = null;
        notifySelectionChanged();
      }
      return;
    }

    if (clientState.hoveredCellId !== cellId) {
      clientState.hoveredCellId = cellId;
      notifySelectionChanged();
    }
  }

  private clearHover(): void {
    if (clientState.hoveredCellId !== null) {
      clientState.hoveredCellId = null;
      notifySelectionChanged();
    }
  }

  private handleClick(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      (2 * (clientX - rect.left) / rect.width) - 1,
      -(2 * (clientY - rect.top) / rect.height) + 1,
    );

    this.raycaster.setFromCamera(pointer, this.camera);

    const hexMeshes: THREE.Object3D[] = [];
    this.globe.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.cellId !== undefined) {
        hexMeshes.push(child);
      }
    });

    const hexIntersects = this.raycaster.intersectObjects(hexMeshes, false);
    if (hexIntersects.length === 0) {
      this.deselectAll();
      return;
    }

    const cellId = this.getCellIdFromIntersection(hexIntersects[0]);
    if (!cellId) {
      this.deselectAll();
      return;
    }

    const visibility = clientState.visibleCells.get(cellId);
    if (!visibility && !clientState.revealedCells.has(cellId)) {
      this.deselectAll();
      return;
    }

    const prevUnitId = clientState.selectedUnitId;
    const prevCityId = clientState.selectedCityId;
    const pendingCommand = clientState.pendingCommand;

    if (pendingCommand === 'move' && prevUnitId) {
      const unit = clientState.units.get(prevUnitId);
      if (unit && unit.status === 'IDLE' && unit.ownerId === clientState.myPlayerId && visibility) {
        if (PASSABLE_TERRAIN.includes(visibility.biome as TerrainType)) {
          sendMoveUnit(prevUnitId, cellId);
          clientState.pendingCommand = null;
          clientState.selectedTileId = cellId;
          clientState.selectedCityId = null;
          notifySelectionChanged();
          return;
        }
      }
    }

    if (cellId === clientState.selectedTileId && !prevUnitId && !prevCityId) {
      this.deselectAll();
      return;
    }

    if (cellId === clientState.selectedTileId && (prevUnitId || prevCityId)) {
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      clientState.pendingCommand = null;
      selectedBuildingId.value = null;
      notifySelectionChanged();
      return;
    }

    // Clicking a different tile while entity is selected: update tile context, keep entity only if still on that tile
    if (prevUnitId) {
      const unit = clientState.units.get(prevUnitId);
      if (unit && unit.cellId === cellId) {
        clientState.selectedTileId = cellId;
        notifySelectionChanged();
        return;
      }
    }
    if (prevCityId) {
      const city = clientState.cities.get(prevCityId);
      if (city && city.cellId === cellId) {
        clientState.selectedTileId = cellId;
        notifySelectionChanged();
        return;
      }
    }

    clientState.selectedTileId = cellId;
    clientState.selectedUnitId = null;
    clientState.selectedCityId = null;
    clientState.pendingCommand = null;
    selectedBuildingId.value = null;

    const unitsOnTile: string[] = [];
    for (const [unitId, unit] of clientState.units) {
      if (unit.cellId === cellId) unitsOnTile.push(unitId);
    }
    const citiesOnTile: string[] = [];
    for (const [cityId, city] of clientState.cities) {
      if (city.cellId === cellId) citiesOnTile.push(cityId);
    }

    if (unitsOnTile.length === 1 && citiesOnTile.length === 0) {
      const unit = clientState.units.get(unitsOnTile[0]);
      if (unit && unit.ownerId === clientState.myPlayerId && unit.status === 'IDLE') {
        clientState.selectedUnitId = unitsOnTile[0];
        clientState.pendingCommand = 'move';
      }
    }

    notifySelectionChanged();
  }

  private deselectAll(): void {
    clientState.selectedTileId = null;
    clientState.selectedUnitId = null;
    clientState.selectedCityId = null;
    selectedBuildingId.value = null;
    clientState.pendingCommand = null;
    notifySelectionChanged();
  }

  private getCellIdFromIntersection(intersection: THREE.Intersection): string | null {
    if (!intersection.object || intersection.object.userData.cellId === undefined) return null;
    const numericId = intersection.object.userData.cellId as number;
    return `cell_${numericId}`;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (clientState.pendingCommand) {
        clientState.pendingCommand = null;
      } else if (clientState.selectedUnitId) {
        clientState.selectedUnitId = null;
      } else if (clientState.selectedCityId) {
        clientState.selectedCityId = null;
      } else {
        clientState.selectedTileId = null;
      }
      notifySelectionChanged();
      return;
    }

    if (e.key === '1' || e.key === 'm' || e.key === 'M') {
      if (clientState.selectedUnitId) {
        this.handleMoveKey();
      } else {
        this.selectEntityOnTile(0);
      }
    }

    if (e.key === '2' || e.key === 'c' || e.key === 'C') {
      if (clientState.selectedUnitId) {
        this.handleClaimKey();
      } else {
        this.selectEntityOnTile(1);
      }
    }

    if (e.key === '3' || e.key === 'b' || e.key === 'B') {
      if (clientState.selectedUnitId) {
        this.handleBuildKey();
      } else {
        this.selectEntityOnTile(2);
      }
    }

    if (e.key === '4') {
      this.selectEntityOnTile(3);
    }
  }

  private selectEntityOnTile(index: number): void {
    const tileId = clientState.selectedTileId;
    if (!tileId) return;

    if (index === 0) {
      for (const [unitId, unit] of clientState.units) {
        if (unit.cellId === tileId && unit.status === 'IDLE') {
          clientState.selectedUnitId = unitId;
          clientState.selectedCityId = null;
          clientState.pendingCommand = unit.ownerId === clientState.myPlayerId ? 'move' : null;
          notifySelectionChanged();
          return;
        }
      }
    } else if (index === 1) {
      for (const [cityId, city] of clientState.cities) {
        if (city.cellId === tileId) {
          clientState.selectedCityId = cityId;
          clientState.selectedUnitId = null;
          clientState.pendingCommand = null;
          notifySelectionChanged();
          return;
        }
      }
    } else {
      const unitsOnTile: string[] = [];
      for (const [unitId, unit] of clientState.units) {
        if (unit.cellId === tileId && unit.status === 'IDLE') unitsOnTile.push(unitId);
      }
      if (unitsOnTile.length > index - 1) {
        clientState.selectedUnitId = unitsOnTile[index - 1];
        clientState.selectedCityId = null;
        clientState.pendingCommand = 'move';
        notifySelectionChanged();
      }
    }
  }

  private handleMoveKey(): void {
    const unitId = clientState.selectedUnitId;
    if (!unitId) return;
    const unit = clientState.units.get(unitId);
    if (!unit || unit.status !== 'IDLE' || unit.ownerId !== clientState.myPlayerId) return;

    clientState.pendingCommand = 'move';
    notifySelectionChanged();
  }

  private handleClaimKey(): void {
    const unitId = clientState.selectedUnitId;
    if (!unitId) return;
    const unit = clientState.units.get(unitId);
    if (!unit || unit.status !== 'IDLE' || unit.ownerId !== clientState.myPlayerId || unit.type !== 'INFANTRY') return;

    sendClaimTerritory(unitId);
    clientState.pendingCommand = null;
    notifySelectionChanged();
  }

  private handleBuildKey(): void {
    const unitId = clientState.selectedUnitId;
    if (!unitId) return;
    const unit = clientState.units.get(unitId);
    if (!unit || unit.status !== 'IDLE' || unit.ownerId !== clientState.myPlayerId) return;

    const canBuildTypes = unit.type === 'ENGINEER'
      ? getEngineerBuildableTypes(CFG, unit.engineerLevel)
      : getInfantryBuildableTypes(CFG);
    if (canBuildTypes.length === 0) return;

    const cellId = unit.cellId;
    const cellData = clientState.visibleCells.get(cellId);
    if (!cellData || cellData.ownerId !== clientState.myPlayerId) return;

    const freeExtractor = canBuildTypes.find((bt: string) => {
      const cost = BUILDING_COSTS[bt];
      if (!cost || cost.food > 0 || cost.material > 0) return false;
      const allowedBiomes = BUILDING_PLACEMENT_RULES[bt];
      if (allowedBiomes && !allowedBiomes.includes(cellData.biome)) return false;
      if (bt === 'CITY') return false;
      return cellData.buildings.length < cellData.buildingCapacity;
    });

    if (freeExtractor) {
      sendBuildStructure(unitId, freeExtractor, cellId);
      clientState.pendingCommand = null;
      notifySelectionChanged();
    }
  }
}