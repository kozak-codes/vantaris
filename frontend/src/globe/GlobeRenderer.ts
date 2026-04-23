import * as THREE from 'three';
import type { HexGrid as HexGridData, HexCell } from '../types/index';
import { BiomeType, FogVisibility } from '../types/index';
import { BIOME_CONFIGS, FOG_CONFIG, GLOBE_CONFIG } from '../constants';

const biomeColorMap = new Map<BiomeType, THREE.Color>(
  BIOME_CONFIGS.map(b => [b.type, new THREE.Color(b.color)]),
);

function getBiomeColor(biome: BiomeType): THREE.Color {
  return biomeColorMap.get(biome)!;
}

function getFogColor(cell: HexCell): THREE.Color {
  if (cell.fog === FogVisibility.UNREVEALED) {
    return new THREE.Color(FOG_CONFIG.unexploredColor);
  }
  if (cell.fog === FogVisibility.REVEALED) {
    return new THREE.Color(FOG_CONFIG.unexploredColor).lerp(new THREE.Color('#333344'), 0.3);
  }
  return getBiomeColor(cell.biome);
}

export class GlobeRenderer {
  private grid: HexGridData;
  private cellMeshes: Map<number, THREE.Mesh> = new Map();
  private borderLines: THREE.LineSegments = null!;
  private globe: THREE.Group;
  private glowMesh: THREE.Mesh | null = null;
  private stars: THREE.Points | null = null;
  private revealAnimations: Map<number, { startTime: number; fromFog: FogVisibility }> = new Map();

  constructor(parent: THREE.Object3D, grid: HexGridData, scene?: THREE.Scene) {
    this.grid = grid;
    this.globe = new THREE.Group();
    parent.add(this.globe);

    this.buildCells();
    this.buildBorders();

    this.glowMesh = this.createAtmosphereGlow();
    if (this.glowMesh) this.globe.add(this.glowMesh);

    this.stars = this.createStarfield();
    if (this.stars && scene) scene.add(this.stars);
  }

  private buildCells(): void {
    const posAttr = 'position';

    for (const cell of this.grid.cells) {
      const geometry = new THREE.BufferGeometry();
      const center = new THREE.Vector3(...cell.center);
      const n = center.clone().normalize();

      const dualVerts = cell.vertexIds.map(fi => {
        const dv = this.grid.vertices[fi];
        return new THREE.Vector3(dv[0], dv[1], dv[2]);
      });

      const positions: number[] = [];
      for (let i = 0; i < dualVerts.length; i++) {
        const next = (i + 1) % dualVerts.length;
        positions.push(
          center.x, center.y, center.z,
          dualVerts[i].x, dualVerts[i].y, dualVerts[i].z,
          dualVerts[next].x, dualVerts[next].y, dualVerts[next].z,
        );
      }

      geometry.setAttribute(posAttr, new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();

      const color = getFogColor(cell);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { cellId: cell.id };
      this.globe.add(mesh);
      this.cellMeshes.set(cell.id, mesh);
    }
  }

  private buildBorders(): void {
    const positions: number[] = [];
    const offset = 0.005;
    const radius = GLOBE_CONFIG.radius;

    for (const cell of this.grid.cells) {
      if (cell.fog === FogVisibility.UNREVEALED) continue;

      const center = new THREE.Vector3(...cell.center);
      const cn = center.clone().normalize();

      const dualVerts = cell.vertexIds.map(fi => {
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

  private createAtmosphereGlow(): THREE.Mesh | null {
    try {
      const glowGeo = new THREE.SphereGeometry(
        GLOBE_CONFIG.radius * 1.12,
        64,
        32,
      );
      const glowMat = new THREE.ShaderMaterial({
        uniforms: {
          glowColor: { value: new THREE.Color(0x4488ff) },
          viewVector: { value: new THREE.Vector3() },
        },
        vertexShader: `
          uniform vec3 viewVector;
          varying float intensity;
          void main() {
            vec3 vNormal = normalize(normalMatrix * normal);
            vec3 vNormel = normalize(normalMatrix * viewVector);
            intensity = pow(0.65 - dot(vNormal, vNormel), 3.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          varying float intensity;
          void main() {
            gl_FragColor = vec4(glowColor, intensity * 0.6);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
      });

      return new THREE.Mesh(glowGeo, glowMat);
    } catch {
      return null;
    }
  }

  private createStarfield(): THREE.Points | null {
    try {
      const starCount = 2000;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 80 + Math.random() * 40;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.3,
        sizeAttenuation: true,
      });
      return new THREE.Points(geo, mat);
    } catch {
      return null;
    }
  }

  forceColorUpdate(): void {
    for (const cell of this.grid.cells) {
      const mesh = this.cellMeshes.get(cell.id);
      if (!mesh) continue;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(getFogColor(cell));
    }
    this.rebuildBorders();
  }

  private rebuildBorders(): void {
    this.globe.remove(this.borderLines);
    this.buildBorders();
  }

  updateFogColors(deltaMs: number): void {
    for (const cell of this.grid.cells) {
      const mesh = this.cellMeshes.get(cell.id);
      if (!mesh) continue;

      const anim = this.revealAnimations.get(cell.id);
      if (anim) {
        const elapsed = performance.now() - anim.startTime;
        const progress = Math.min(elapsed / FOG_CONFIG.revealAnimationMs, 1);
        const targetColor = getFogColor(cell);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.lerp(targetColor, progress);
        if (progress >= 1) {
          this.revealAnimations.delete(cell.id);
        }
      } else {
        const targetColor = getFogColor(cell);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.lerp(targetColor, 0.15);
      }
    }
  }

  beginRevealAnimation(cellId: number, fromFog: FogVisibility): void {
    this.revealAnimations.set(cellId, {
      startTime: performance.now(),
      fromFog,
    });
  }

  getCellAtIntersection(intersection: THREE.Intersection): number | null {
    if (!intersection.object || intersection.object.userData.cellId === undefined) return null;
    return intersection.object.userData.cellId as number;
  }

  getGlobeGroup(): THREE.Group {
    return this.globe;
  }

  updateGlow(camera: THREE.Camera): void {
    if (this.glowMesh) {
      const mat = this.glowMesh.material as THREE.ShaderMaterial;
      const camWorldPos = new THREE.Vector3();
      camera.getWorldPosition(camWorldPos);
      mat.uniforms.viewVector.value.copy(camWorldPos);
    }
  }
}