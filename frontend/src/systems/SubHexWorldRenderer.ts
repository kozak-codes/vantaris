import * as THREE from 'three';
import {
  CFG,
  sampleWorldTerrain,
  type SubHexData,
  type ConstructionData,
  type ConstructionType,
} from '@vantaris/shared';
import type { WorkerRequest, WorkerResponse } from './terrainWorker';

const CONSTRUCTION_COLORS: Record<ConstructionType, number> = {
  HAB: 0x4488ff,
  MINE: 0xff8844,
  FARM: 0x44cc44,
  FACTORY: 0xcc8844,
  ROAD: 0x888888,
  PORT: 0x44cccc,
  SPACEPORT: 0xcc44cc,
};

interface CellGeo {
  center: [number, number, number];
  vertexPositions: [number, number, number][];
  vertexIds?: number[];
}

interface CellInfo {
  geo: CellGeo;
  fogged: boolean;
  unexplored?: boolean;
}

/** Cached per-cell geometry data. Built once, reused across mesh rebuilds. */
interface CellCache {
  positions: Float32Array;
  colors: Float32Array;
  subHexes: SubHexData[];
  spherePositions: THREE.Vector3[];
  subSize: number;
}

/**
 * Renders terrain as a single continuous mesh covering all visible and
 * revealed cells. Because all cells share one mesh, boundary vertices
 * between adjacent cells are identical — no seams, no skirts needed
 * (except around the outer edge of the visible region).
 *
 * Per-cell geometry is cached so that only newly-seen cells need terrain
 * sampling on a rebuild. The mesh rebuild itself is just array concatenation.
 */
export class SubHexWorldRenderer {
  private parent: THREE.Object3D;
  private root: THREE.Group;
  private terrainMesh: THREE.Mesh | null = null;
  private fogMesh: THREE.Mesh | null = null;
  private blackSphere: THREE.Mesh | null = null;
  private borderLines: THREE.LineSegments | null = null;
  private cellInfos = new Map<string, CellInfo>();
  private unexploredIds = new Set<string>();
  private cellGeometry = new Map<string, CellGeo>();
  private adjacency = new Map<number, number[]>();
  private cellCache = new Map<string, CellCache>();
  private subHexDataMap = new Map<string, { subHexes: SubHexData[]; spherePositions: THREE.Vector3[]; subSize: number }>();
  private constructionMeshes = new Map<string, THREE.Mesh>();
  private raycaster = new THREE.Raycaster();
  private worldSeed: number = 42;
  private macroMeshes: Map<string, THREE.Mesh> = new Map();
  private terrainDirty = false;
  private worker: Worker | null = null;
  private pendingCells = new Set<string>();
  private inFlightCells = new Set<string>();

  constructor(parent: THREE.Object3D, macroMeshes?: Map<number, THREE.Mesh> | Map<string, THREE.Mesh>) {
    this.parent = parent;
    if (macroMeshes) {
      for (const [id, mesh] of macroMeshes) {
        const key = typeof id === 'number' ? `cell_${id}` : id;
        this.macroMeshes.set(key, mesh);
      }
    }
    this.root = new THREE.Group();
    this.root.visible = false;
    parent.add(this.root);

    // Black sphere at sea level — prevents seeing through the globe while
    // terrain cells are still being sampled by the worker.
    const sphereGeo = new THREE.SphereGeometry(CFG.GLOBE.radius, 64, 32);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.blackSphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.root.add(this.blackSphere);

    // Spawn terrain worker.
    this.worker = new Worker(new URL('./terrainWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const res = e.data;
      this.pendingCells.delete(res.cellId);
      this.inFlightCells.delete(res.cellId);

      // Convert flat sphere positions back to Vector3 array.
      const spherePositions: THREE.Vector3[] = [];
      for (let i = 0; i < res.spherePositions.length; i += 3) {
        spherePositions.push(new THREE.Vector3(
          res.spherePositions[i],
          res.spherePositions[i + 1],
          res.spherePositions[i + 2],
        ));
      }

      this.cellCache.set(res.cellId, {
        positions: res.positions,
        colors: res.colors,
        subHexes: res.subHexes,
        spherePositions,
        subSize: res.subSize,
      });
      this.terrainDirty = true;
    };
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  setWorldSeed(seed: number): void {
    if (this.worldSeed !== seed) {
      this.worldSeed = seed;
      this.cellCache.clear();
      this.pendingCells.clear();
      this.inFlightCells.clear();
      this.terrainDirty = true;
    }
  }

  updateVisibility(
    visibleCells: Map<string, { ownerId: string }>,
    cellGeometry: Map<string, CellGeo>,
    revealedCells?: Map<string, { lastKnownOwnerId: string }>,
    adjacency?: Map<number, number[]>,
    allCellIds?: Set<string>,
  ): void {
    const newInfos = new Map<string, CellInfo>();
    this.cellGeometry = cellGeometry;
    if (adjacency) this.adjacency = adjacency;

    for (const [cellId] of visibleCells) {
      const geo = cellGeometry.get(cellId);
      if (!geo) continue;
      newInfos.set(cellId, { geo, fogged: false });
    }

    if (revealedCells) {
      for (const [cellId] of revealedCells) {
        if (newInfos.has(cellId)) continue;
        const geo = cellGeometry.get(cellId);
        if (!geo) continue;
        newInfos.set(cellId, { geo, fogged: true });
      }
    }

    // Collect unexplored cells (all cells not visible or revealed).
    const unexploredIds = new Set<string>();
    if (allCellIds) {
      for (const cellId of allCellIds) {
        if (!newInfos.has(cellId)) {
          const geo = cellGeometry.get(cellId);
          if (geo) unexploredIds.add(cellId);
        }
      }
    } else if (adjacency) {
      // Fallback: border cells only.
      for (const cellId of newInfos.keys()) {
        const numId = parseInt(cellId.replace('cell_', ''));
        if (isNaN(numId)) continue;
        const neighbors = adjacency.get(numId);
        if (!neighbors) continue;
        for (const nId of neighbors) {
          const nKey = `cell_${nId}`;
          if (!newInfos.has(nKey)) unexploredIds.add(nKey);
        }
      }
    }

    // Check if the set of cells changed.
    const newKeys = new Set(newInfos.keys());
    const oldKeys = new Set(this.cellInfos.keys());
    let changed = newKeys.size !== oldKeys.size;
    if (!changed) {
      for (const k of newKeys) {
        if (!oldKeys.has(k)) { changed = true; break; }
      }
    }

    // Always check if any cell's visibility state changed (e.g. unexplored → visible).
    // Request re-sampling but DON'T evict the old cache — it serves as a placeholder
    // (old terrain/fog appearance) until the new sample arrives.
    for (const [cellId, newInfo] of newInfos) {
      const oldInfo = this.cellInfos.get(cellId);
      if (!oldInfo) { changed = true; continue; } // New cell — no placeholder needed.
      if (oldInfo.fogged !== newInfo.fogged || (oldInfo.unexplored ?? false) !== (newInfo.unexplored ?? false)) {
        // Force re-sampling by marking the cell as needing a new sample.
        // We keep the old cache so the cell still renders until the new one arrives.
        this.pendingCells.add(cellId);
        changed = true;
      }
    }

    // Check if unexplored set changed.
    const oldUnexplored = this.unexploredIds;
    if (unexploredIds.size !== oldUnexplored.size) {
      changed = true;
    } else {
      for (const id of unexploredIds) {
        if (!oldUnexplored.has(id)) { changed = true; break; }
      }
    }

    if (changed) {
      this.cellInfos = newInfos;
      this.unexploredIds = unexploredIds;
      this.terrainDirty = true;

      // Show/hide macro meshes — hide all cells in the terrain mesh or fog mesh.
      for (const [cellId, mesh] of this.macroMeshes) {
        mesh.visible = !newInfos.has(cellId) && !unexploredIds.has(cellId);
      }
    }
  }

  /**
   * Rebuild the terrain mesh if dirty. Called from the animate loop.
   * Requests worker sampling for uncached cells, assembles cached data.
   */
  update(): void {
    // Mark uncached cells as pending (don't send yet — unified below).
    for (const [cellId] of this.cellInfos) {
      if (this.pendingCells.has(cellId)) continue;
      if (this.inFlightCells.has(cellId)) continue;
      if (this.cellCache.has(cellId)) continue;
      this.pendingCells.add(cellId);
    }

    // Send worker requests for pending cells (new + re-sampling).
    for (const cellId of this.pendingCells) {
      const info = this.cellInfos.get(cellId);
      if (!info) { this.pendingCells.delete(cellId); continue; }
      this.pendingCells.delete(cellId);
      this.inFlightCells.add(cellId);
      this.worker?.postMessage({
        cellId,
        center: info.geo.center,
        vertexPositions: info.geo.vertexPositions,
        worldSeed: this.worldSeed,
        fogged: info.fogged,
        unexplored: info.unexplored ?? false,
        heightBlend: 1.0,
      } as WorkerRequest);
    }

    if (!this.terrainDirty) return;
    this.terrainDirty = false;
    this.rebuildTerrain();
  }

  private rebuildTerrain(): void {
    if (this.terrainMesh) {
      this.root.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
      this.terrainMesh = null;
    }
    if (this.fogMesh) {
      this.root.remove(this.fogMesh);
      this.fogMesh.geometry.dispose();
      (this.fogMesh.material as THREE.Material).dispose();
      this.fogMesh = null;
    }
    this.subHexDataMap.clear();

    if (this.cellInfos.size === 0) return;

    // Populate subHexDataMap from cached cells (skip cells still pending).
    for (const [cellId] of this.cellInfos) {
      const cache = this.cellCache.get(cellId);
      if (!cache) continue;
      this.subHexDataMap.set(cellId, {
        subHexes: cache.subHexes,
        spherePositions: cache.spherePositions,
        subSize: cache.subSize,
      });
    }

    // Build terrain mesh (visible + revealed only — no unexplored cells).
    let terrainLen = 0;
    for (const [cellId, info] of this.cellInfos) {
      if (info.unexplored) continue;
      const cache = this.cellCache.get(cellId);
      if (cache) terrainLen += cache.positions.length;
    }

    if (terrainLen > 0) {
      const posArr = new Float32Array(terrainLen);
      const colArr = new Float32Array(terrainLen);
      let off = 0;
      for (const [cellId, info] of this.cellInfos) {
        if (info.unexplored) continue;
        const cache = this.cellCache.get(cellId);
        if (!cache) continue;
        posArr.set(cache.positions, off);
        colArr.set(cache.colors, off);
        off += cache.positions.length;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(posArr.subarray(0, off), 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colArr.subarray(0, off), 3));

      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        metalness: 0.05,
        side: THREE.DoubleSide,
        flatShading: true,
      });

      this.terrainMesh = new THREE.Mesh(geometry, material);
      this.terrainMesh.userData = { terrain: true };
      this.root.add(this.terrainMesh);
    }

    // Build opaque fog mesh from all unexplored cells + any visible/revealed
    // cells that don't have terrain data yet (still sampling in worker).
    // These show fog as a placeholder until the terrain mesh arrives.
    const fogPlaceholderIds = new Set<string>(this.unexploredIds);
    for (const [cellId, info] of this.cellInfos) {
      if (info.unexplored) continue;
      if (!this.cellCache.has(cellId)) {
        fogPlaceholderIds.add(cellId); // newly visible, no terrain yet
      }
    }
    if (fogPlaceholderIds.size > 0) {
      this.fogMesh = this.buildFogMesh(fogPlaceholderIds);
      this.root.add(this.fogMesh);
    }

    // Build hex boundary lines on the terrain surface.
    this.buildBorderLines();
  }

  private buildFogMesh(fogCellIds: Set<string>): THREE.Mesh {
    const globeRadius = CFG.GLOBE.radius;
    const wallHeight = CFG.SUBHEX.heightMax;
    const fogColor = new THREE.Color(0x0a0a14);

    const positions: number[] = [];

    // Build a set of explored cell IDs (with terrain data) for wall edge detection.
    const exploredIds = new Set<string>();
    for (const [cellId, info] of this.cellInfos) {
      if (!info.unexplored && this.cellCache.has(cellId)) {
        exploredIds.add(cellId);
      }
    }

    for (const cellId of fogCellIds) {
      const geo = this.cellGeometry.get(cellId);
      if (!geo) continue;

      const boundary = geo.vertexPositions;
      const vertexIds = geo.vertexIds;
      const n = boundary.length;

      // Project boundary to top (at wallHeight) and bottom (at globeRadius).
      const top: [number, number, number][] = [];
      const bottom: [number, number, number][] = [];
      for (const p of boundary) {
        const len = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 1;
        const rt = globeRadius + wallHeight;
        top.push([(p[0] / len) * rt, (p[1] / len) * rt, (p[2] / len) * rt]);
        bottom.push([(p[0] / len) * globeRadius, (p[1] / len) * globeRadius, (p[2] / len) * globeRadius]);
      }

      // Top cap: triangle fan from vertex 0.
      for (let i = 1; i < n - 1; i++) {
        positions.push(top[0][0], top[0][1], top[0][2]);
        positions.push(top[i][0], top[i][1], top[i][2]);
        positions.push(top[i + 1][0], top[i + 1][1], top[i + 1][2]);
      }

      // Walls: only on edges that border an explored (visible/revealed) cell.
      // Each edge i connects vertexIds[i] and vertexIds[(i+1) % n].
      // Find which neighbor shares this edge.
      if (vertexIds && vertexIds.length === n) {
        const numId = parseInt(cellId.replace('cell_', ''));
        const neighbors = this.adjacency.get(numId) || [];

        for (let i = 0; i < n; i++) {
          const ni = (i + 1) % n;
          const v0 = vertexIds[i];
          const v1 = vertexIds[ni];

          // Find which neighbor shares both v0 and v1.
          let borderExplored = false;
          for (const nId of neighbors) {
            const nKey = `cell_${nId}`;
            if (!exploredIds.has(nKey)) continue;
            const nGeo = this.cellGeometry.get(nKey);
            if (!nGeo?.vertexIds) continue;
            if (nGeo.vertexIds.includes(v0) && nGeo.vertexIds.includes(v1)) {
              borderExplored = true;
              break;
            }
          }

          if (borderExplored) {
            // Triangle 1: top[i], top[ni], bottom[i]
            positions.push(top[i][0], top[i][1], top[i][2]);
            positions.push(top[ni][0], top[ni][1], top[ni][2]);
            positions.push(bottom[i][0], bottom[i][1], bottom[i][2]);
            // Triangle 2: top[ni], bottom[ni], bottom[i]
            positions.push(top[ni][0], top[ni][1], top[ni][2]);
            positions.push(bottom[ni][0], bottom[ni][1], bottom[ni][2]);
            positions.push(bottom[i][0], bottom[i][1], bottom[i][2]);
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: fogColor,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { terrain: true };
    return mesh;
  }

  private buildBorderLines(): void {
    if (this.borderLines) {
      this.root.remove(this.borderLines);
      this.borderLines.geometry.dispose();
      (this.borderLines.material as THREE.Material).dispose();
      this.borderLines = null;
    }

    const globeRadius = CFG.GLOBE.radius;
    const positions: number[] = [];

    for (const [, info] of this.cellInfos) {
      const blend = info.unexplored ? 0.0 : 1.0;
      const verts = info.geo.vertexPositions;
      const sampleOnSurface = (v: [number, number, number]): THREE.Vector3 => {
        const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
        const sx = (v[0] / len) * globeRadius;
        const sy = (v[1] / len) * globeRadius;
        const sz = (v[2] / len) * globeRadius;
        const { height } = sampleWorldTerrain([sx, sy, sz], this.worldSeed);
        return new THREE.Vector3(sx, sy, sz).normalize().multiplyScalar(globeRadius + height * blend + 0.05);
      };

      for (let i = 0; i < verts.length; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];

        const STEPS = 8;
        let prev = sampleOnSurface(a);
        for (let s = 1; s <= STEPS; s++) {
          const t = s / STEPS;
          // Interpolate in 3D, then project onto sphere + sample terrain.
          const mx = a[0] * (1 - t) + b[0] * t;
          const my = a[1] * (1 - t) + b[1] * t;
          const mz = a[2] * (1 - t) + b[2] * t;
          const next = sampleOnSurface([mx, my, mz]);
          positions.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
          prev = next;
        }
      }
    }

    if (positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
        depthTest: true,
      });
      this.borderLines = new THREE.LineSegments(geom, mat);
      this.borderLines.raycast = () => {};
      this.root.add(this.borderLines);
    }
  }

  updateConstructions(constructions: Map<string, ConstructionData>): void {
    for (const [id, mesh] of this.constructionMeshes) {
      if (!constructions.has(id)) {
        this.root.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.constructionMeshes.delete(id);
      }
    }

    for (const [id, c] of constructions) {
      if (this.constructionMeshes.has(id)) continue;
      const data = this.subHexDataMap.get(c.macroCellId);
      if (!data) continue;
      if (c.subHexIndex < 0 || c.subHexIndex >= data.subHexes.length) continue;

      const spherePos = data.spherePositions[c.subHexIndex];
      const height = data.subHexes[c.subHexIndex].height;
      const subSize = data.subSize;

      const radial = spherePos.clone().normalize();
      const surfacePos = spherePos.clone().add(radial.clone().multiplyScalar(height));

      const geo = new THREE.BoxGeometry(subSize * 0.5, subSize * 0.5, subSize * 0.3);
      const color = new THREE.Color(CONSTRUCTION_COLORS[c.type] ?? 0xffffff);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.copy(surfacePos);
      mesh.lookAt(surfacePos.clone().add(radial));
      mesh.rotateX(Math.PI / 2);
      this.root.add(mesh);
      this.constructionMeshes.set(id, mesh);
    }
  }

  pickSubHex(camera: THREE.Camera, pointer: THREE.Vector2): { cellId: string; subHexIndex: number } | null {
    if (!this.root.visible) return null;
    this.raycaster.setFromCamera(pointer, camera);

    // Prefer raycasting against the terrain mesh — it only covers visible/
    // revealed cells, so hits are always on actual terrain. The terrain
    // mesh is DoubleSide, so we may get back-face hits on the far side;
    // the nearest-sub-hex distance threshold filters those out.
    if (this.terrainMesh) {
      const hits = this.raycaster.intersectObject(this.terrainMesh, false);
      if (hits.length > 0) {
        // Try the closest hit first; if it's too far from any known sub-hex
        // (back face on far side), try subsequent hits.
        for (const hit of hits) {
          const localPoint = hit.point.clone();
          this.root.worldToLocal(localPoint);
          const r = this.findNearestSubHex(localPoint);
          if (r) return r;
        }
      }
    }

    // Fallback: raycast against the fog mesh (covers unexplored cells).
    if (this.fogMesh) {
      const hits = this.raycaster.intersectObject(this.fogMesh, false);
      if (hits.length > 0) {
        for (const hit of hits) {
          const localPoint = hit.point.clone();
          this.root.worldToLocal(localPoint);
          const r = this.findNearestSubHex(localPoint);
          if (r) return r;
        }
      }
    }

    return null;
  }

  /** Find the nearest sub-hex in the data map to a LOCAL-space point. */
  private findNearestSubHex(localPoint: THREE.Vector3): { cellId: string; subHexIndex: number } | null {
    let bestCellId = '';
    let bestIdx = -1;
    let bestDist = Infinity;
    for (const [cellId, data] of this.subHexDataMap) {
      for (let i = 0; i < data.spherePositions.length; i++) {
        const d = data.spherePositions[i].distanceTo(localPoint);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
          bestCellId = cellId;
        }
      }
    }
    if (bestIdx < 0) return null;
    // Reject picks where the nearest sub-hex is far from the hit point
    // (back-face hits on the far side of the globe).
    if (bestDist > 0.5) return null;
    return { cellId: bestCellId, subHexIndex: bestIdx };
  }

  getSubHex(cellId: string, subHexIndex: number): SubHexData | null {
    const data = this.subHexDataMap.get(cellId);
    if (!data || subHexIndex < 0 || subHexIndex >= data.subHexes.length) return null;
    return data.subHexes[subHexIndex];
  }

  clear(): void {
    if (this.terrainMesh) {
      this.root.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
      this.terrainMesh = null;
    }
    if (this.fogMesh) {
      this.root.remove(this.fogMesh);
      this.fogMesh.geometry.dispose();
      (this.fogMesh.material as THREE.Material).dispose();
      this.fogMesh = null;
    }
    if (this.borderLines) {
      this.root.remove(this.borderLines);
      this.borderLines.geometry.dispose();
      (this.borderLines.material as THREE.Material).dispose();
      this.borderLines = null;
    }
    this.cellInfos.clear();
    this.unexploredIds.clear();
    this.cellCache.clear();
    this.pendingCells.clear();
    this.inFlightCells.clear();
    this.subHexDataMap.clear();
    for (const [, mesh] of this.constructionMeshes) {
      this.root.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.constructionMeshes.clear();
    for (const [, mesh] of this.macroMeshes) {
      mesh.visible = true;
    }
    this.terrainDirty = false;
  }

  dispose(): void {
    this.clear();
    if (this.blackSphere) {
      this.blackSphere.geometry.dispose();
      (this.blackSphere.material as THREE.Material).dispose();
      this.blackSphere = null;
    }
    this.worker?.terminate();
    this.worker = null;
  }
}