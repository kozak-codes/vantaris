import * as THREE from 'three';
import { clientState } from '../state/ClientState';
import { landingTargetBodyId, landingError, setLandingError, orbitalBodies } from '../state/signals';
import { CFG, sampleWorldTerrain, generateSubHexCoords, subHexSize, ElevationTier, type HexGrid, type SubHexData } from '@vantaris/shared';
import { SubHexWorldRenderer } from './SubHexWorldRenderer';
import { LabelRenderer } from './LabelRenderer';
import { GLOBE_RADIUS } from './IconFactory';

const GHOST_COLOR_VALID = 0x44ff44;
const GHOST_COLOR_INVALID = 0xff4444;
const GHOST_EMISSIVE_VALID = 0x224422;
const GHOST_EMISSIVE_INVALID = 0x441111;

/**
 * Renders a "ghost" preview of the lander at the sub-hex the player is
 * hovering over during landing-target selection. The ghost is green when the
 * sub-hex is buildable (FLAT terrain) and within the lander's wiggle range;
 * red otherwise, with a tooltip explaining why.
 *
 * Click handling is done in GlobeInput; this class only renders the preview
 * + tooltip and exposes `getHoveredTarget()` so GlobeInput can send the
 * chosen cell + sub-hex to the server.
 */
export class LandingGhostRenderer {
  private root: THREE.Group;
  private grid: HexGrid;
  private subHexRenderer: SubHexWorldRenderer;
  private camera: THREE.Camera;
  private ghost: THREE.Group;
  private ghostMaterial: THREE.MeshStandardMaterial;
  private tooltip: THREE.Sprite | null = null;
  private tooltipCanvas: HTMLCanvasElement | null = null;
  private tooltipCtx: CanvasRenderingContext2D | null = null;
  private tooltipTexture: THREE.CanvasTexture | null = null;
  private tooltipText: string = '';
  private labelRenderer = new LabelRenderer();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  /** Current hovered target: { cellId, subHexIndex, valid, reason } or null. */
  private hovered: { cellId: string; subHexIndex: number; valid: boolean; reason: string } | null = null;

  constructor(root: THREE.Group, grid: HexGrid, subHexRenderer: SubHexWorldRenderer, camera: THREE.Camera) {
    this.root = root;
    this.grid = grid;
    this.subHexRenderer = subHexRenderer;
    this.camera = camera;

    this.ghostMaterial = new THREE.MeshStandardMaterial({
      color: GHOST_COLOR_VALID,
      emissive: GHOST_EMISSIVE_VALID,
      transparent: true,
      opacity: 0.6,
      roughness: 0.6,
    });

    this.ghost = this.buildLanderGhost();
    this.ghost.visible = false;
    this.ghost.raycast = () => {};
    this.root.add(this.ghost);
  }

  private buildLanderGhost(): THREE.Group {
    const group = new THREE.Group();
    group.userData.isLandingGhost = true;

    const mat = this.ghostMaterial;
    const s = 0.5;
    const bodyGeo = new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.12 * s, 12);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.raycast = () => {};
    group.add(bodyMesh);

    const noseGeo = new THREE.ConeGeometry(0.04 * s, 0.06 * s, 12);
    const nose = new THREE.Mesh(noseGeo, mat);
    nose.position.y = 0.09 * s;
    nose.raycast = () => {};
    group.add(nose);

    const legGeo = new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.1 * s, 6);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(Math.cos(angle) * 0.05 * s, -0.05 * s, Math.sin(angle) * 0.05 * s);
      leg.rotation.z = Math.cos(angle) * 0.3;
      leg.rotation.x = -Math.sin(angle) * 0.3;
      leg.raycast = () => {};
      group.add(leg);
    }

    group.raycast = () => {};
    return group;
  }

  /**
   * Called each frame with the current mouse position (client coords). Picks
   * the sub-hex under the cursor, validates it, and moves the ghost.
   */
  update(mouseClientX: number, mouseClientY: number): void {
    const bodyId = landingTargetBodyId.value;
    if (!bodyId) {
      this.hideGhost();
      return;
    }
    const body = orbitalBodies.value.get(bodyId);
    if (!body || body.type !== 'SPACECRAFT' || body.landedCellId || body.descending) {
      this.hideGhost();
      return;
    }

    const canvas = document.getElementById('globe-canvas') as HTMLCanvasElement;
    if (!canvas) { this.hideGhost(); return; }
    const rect = canvas.getBoundingClientRect();
    this.pointer.set(
      ((mouseClientX - rect.left) / rect.width) * 2 - 1,
      -((mouseClientY - rect.top) / rect.height) * 2 + 1,
    );

    const pick = this.subHexRenderer.pickSubHex(this.camera, this.pointer);
    if (!pick) {
      this.hideGhost();
      return;
    }

    const sub = this.subHexRenderer.getSubHex(pick.cellId, pick.subHexIndex);
    if (!sub) {
      this.hideGhost();
      return;
    }

    // Validate: buildable (FLAT tier) + within wiggle of lander sub-point.
    const { valid, reason } = this.validateTarget(pick.cellId, pick.subHexIndex, sub, body);

    // Position the ghost at the sub-hex surface.
    const pos = this.computeSubHexWorldPos(pick.cellId, pick.subHexIndex, sub);
    if (!pos) { this.hideGhost(); return; }

    this.ghost.visible = true;
    this.ghost.position.copy(pos.position);
    // Orient: stand upright on the surface (capsule +Y axis along normal).
    this.ghost.lookAt(pos.position.clone().add(pos.normal));
    this.ghost.rotateX(-Math.PI / 2);

    // Color: green if valid, red if not.
    if (valid) {
      this.ghostMaterial.color.setHex(GHOST_COLOR_VALID);
      this.ghostMaterial.emissive.setHex(GHOST_EMISSIVE_VALID);
      setLandingError(null);
    } else {
      this.ghostMaterial.color.setHex(GHOST_COLOR_INVALID);
      this.ghostMaterial.emissive.setHex(GHOST_EMISSIVE_INVALID);
      setLandingError(reason);
    }

    this.hovered = { cellId: pick.cellId, subHexIndex: pick.subHexIndex, valid, reason };

    // Tooltip label above the ghost.
    this.updateTooltip(reason, valid, pos.position, pos.normal);

    // Scale labels with camera distance.
    this.labelRenderer.update(this.camera);
  }

  /** Current hovered target (or null). Used by GlobeInput to send landAt. */
  getHoveredTarget(): { cellId: string; subHexIndex: number; valid: boolean } | null {
    if (!this.hovered) return null;
    return {
      cellId: this.hovered.cellId,
      subHexIndex: this.hovered.subHexIndex,
      valid: this.hovered.valid,
    };
  }

  private validateTarget(
    cellId: string,
    _subHexIndex: number,
    sub: SubHexData,
    body: { position: [number, number, number]; elements: { parent: string } },
  ): { valid: boolean; reason: string } {
    if (!sub.buildable) {
      // Check the tier for a better error message.
      if (sub.tier === ElevationTier.DEEP_WATER || sub.tier === ElevationTier.SHALLOW_WATER) {
        return { valid: false, reason: 'Cannot land on water' };
      }
      if (sub.tier === ElevationTier.MOUNTAIN) {
        return { valid: false, reason: 'Cannot land on mountains' };
      }
      if (sub.tier === ElevationTier.HILL) {
        return { valid: false, reason: 'Cannot land on hills — flat terrain only' };
      }
      return { valid: false, reason: 'Terrain not buildable' };
    }

    // Within wiggle distance of the lander's sub-point?
    const subPointCellId = this.findCellBelowLander(body);
    if (!subPointCellId) {
      return { valid: false, reason: 'Cannot determine lander position' };
    }
    if (!this.isWithinWiggle(subPointCellId, cellId, CFG.LANDING.wiggleCells)) {
      return { valid: false, reason: `Too far from lander's ground track (max ${CFG.LANDING.wiggleCells} tiles)` };
    }

    return { valid: true, reason: '' };
  }

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

  private isWithinWiggle(start: string, target: string, maxHops: number): boolean {
    if (start === target) return true;
    const parseId = (s: string) => parseInt(s.replace('cell_', ''), 10);
    const startId = parseId(start);
    const targetId = parseId(target);
    if (isNaN(startId) || isNaN(targetId)) return false;

    const visited = new Set<number>([startId]);
    let frontier = new Set<number>([startId]);
    for (let i = 0; i < maxHops; i++) {
      const next = new Set<number>();
      for (const cid of frontier) {
        const neighbors = this.grid.adjacency.get(cid) ?? [];
        for (const nId of neighbors) {
          if (nId === targetId) return true;
          if (visited.has(nId)) continue;
          visited.add(nId);
          next.add(nId);
        }
      }
      frontier = next;
    }
    return false;
  }

  /**
   * Compute the world-space position + surface normal for a sub-hex, mirroring
   * the formula in SpacecraftRenderer/SubHexWorldRenderer.
   */
  private computeSubHexWorldPos(
    cellId: string,
    subHexIndex: number,
    sub: SubHexData,
  ): { position: THREE.Vector3; normal: THREE.Vector3 } | null {
    const numericId = parseInt(cellId.replace('cell_', ''), 10);
    if (isNaN(numericId) || numericId < 0 || numericId >= this.grid.cells.length) return null;
    const cellCenterArr = this.grid.cells[numericId].center;
    const cellCenter = new THREE.Vector3(cellCenterArr[0], cellCenterArr[1], cellCenterArr[2]);
    const normal = cellCenter.clone().normalize();

    // Sub-hex offset in the tangent plane (same formula as SpacecraftRenderer).
    const radius = CFG.SUBHEX.radius;
    const coords = generateSubHexCoords(radius);
    const macroCircumradius = 0.3;
    const subSize = subHexSize(macroCircumradius, radius);
    const coord = coords[subHexIndex] || { q: 0, r: 0 };
    const SQRT3 = Math.sqrt(3);
    const px = subSize * (SQRT3 * coord.q + (SQRT3 / 2) * coord.r);
    const py = subSize * (3 / 2) * coord.r;

    const nx = normal.x, ny = normal.y, nz = normal.z;
    let upX = 0, upY = 0, upZ = 1;
    if (Math.abs(nz) > 0.9) { upX = 1; upY = 0; upZ = 0; }
    let uX = ny * upZ - nz * upY;
    let uY = nz * upX - nx * upZ;
    let uZ = nx * upY - ny * upX;
    const uLen = Math.sqrt(uX * uX + uY * uY + uZ * uZ) || 1;
    uX /= uLen; uY /= uLen; uZ /= uLen;
    const vX = ny * uZ - nz * uY;
    const vY = nz * uX - nx * uZ;
    const vZ = nx * uY - ny * uX;

    const tx = cellCenter.x + uX * px + vX * py;
    const ty = cellCenter.y + uY * px + vY * py;
    const tz = cellCenter.z + uZ * px + vZ * py;
    const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    const worldPos: [number, number, number] = [
      (tx / tLen) * GLOBE_RADIUS,
      (ty / tLen) * GLOBE_RADIUS,
      (tz / tLen) * GLOBE_RADIUS,
    ];

    // Sample terrain height at this position to place the ghost on the surface.
    const { height } = sampleWorldTerrain(worldPos, clientState.worldSeed);
    const surfaceRadius = GLOBE_RADIUS + height + 0.05;
    const surfaceNormal = new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]).normalize();
    return {
      position: surfaceNormal.clone().multiplyScalar(surfaceRadius),
      normal: surfaceNormal,
    };
  }

  private updateTooltip(reason: string, valid: boolean, pos: THREE.Vector3, normal: THREE.Vector3): void {
    const text = valid ? 'LAND HERE' : reason;
    const bg = valid ? 'rgba(34,68,34,0.85)' : 'rgba(68,34,34,0.85)';
    const color = valid ? '#88ff88' : '#ffaaaa';

    // Create the tooltip sprite once; reuse it across frames. Only redraw
    // the canvas when the text changes (avoids per-frame texture churn).
    if (!this.tooltip) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = 256;
      canvas.height = 32;
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      this.tooltip = new THREE.Sprite(material);
      this.tooltip.raycast = () => {};
      this.tooltipCanvas = canvas;
      this.tooltipCtx = ctx;
      this.tooltipTexture = texture;
      this.labelRenderer.registerLabel(this.tooltip, { targetWorldHeight: 0.12, minScale: 0.04 });
      this.root.add(this.tooltip);
    }

    // Position the tooltip above the ghost.
    this.tooltip.position.copy(pos).add(normal.clone().multiplyScalar(0.25));

    // Only redraw if the text changed.
    if (text !== this.tooltipText) {
      this.tooltipText = text;
      const ctx = this.tooltipCtx!;
      const canvas = this.tooltipCanvas!;
      const fontSize = 14;
      ctx.font = `bold ${fontSize}px ui-monospace, monospace`;
      const textWidth = ctx.measureText(text).width;
      canvas.width = Math.ceil(textWidth) + 8;
      canvas.height = fontSize + 8;
      ctx.font = `bold ${fontSize}px ui-monospace, monospace`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;
      ctx.fillText(text, 4, canvas.height / 2);
      this.tooltipTexture!.needsUpdate = true;
    }
  }

  private hideGhost(): void {
    this.ghost.visible = false;
    if (this.tooltip) {
      this.tooltip.visible = false;
    }
    this.hovered = null;
    this.tooltipText = '';
    setLandingError(null);
  }

  dispose(): void {
    this.hideGhost();
    this.root.remove(this.ghost);
    this.ghost.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    this.ghostMaterial.dispose();
    if (this.tooltip) {
      this.root.remove(this.tooltip);
      this.labelRenderer.unregisterLabel(this.tooltip);
      this.tooltipTexture?.dispose();
      this.tooltip.material.dispose();
      this.tooltip = null;
    }
    this.labelRenderer.dispose();
  }
}