import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { GLOBE_RADIUS } from './IconFactory';
import { CFG } from '@vantaris/shared';

const MOON_INTENSITY = 0.3;
const MOON_ORBIT_TILT = 0.35;
const MOON_ORBIT_RADIUS = 3.5;

export class DayNightRenderer {
  private ambientLight: THREE.AmbientLight;
  private globeGroup: THREE.Group;
  private cellMeshes: Map<string, THREE.Mesh>;
  private cityGlowLights: Map<string, THREE.PointLight> = new Map();
  private lastSunAngle: number = -1;
  private nightColor: THREE.Color = new THREE.Color('#040410');
  private glowColor: THREE.Color = new THREE.Color(CFG.DAY_NIGHT.CITY_GLOW_COLOR);
  private sunLight: THREE.DirectionalLight;
  private moonLight: THREE.DirectionalLight;
  private moonOrb: THREE.Mesh;
  private hemisphereLight: THREE.HemisphereLight;

  constructor(
    ambientLight: THREE.AmbientLight,
    globeGroup: THREE.Group,
    cellMeshes: Map<string, THREE.Mesh>,
  ) {
    this.ambientLight = ambientLight;
    this.globeGroup = globeGroup;
    this.cellMeshes = cellMeshes;

    this.hemisphereLight = new THREE.HemisphereLight(0x6688bb, 0x222244, 0.5);
    globeGroup.parent?.add(this.hemisphereLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, CFG.DAY_NIGHT.SUN_INTENSITY);
    this.sunLight.position.set(GLOBE_RADIUS * 2, 0, 0);
    this.sunLight.target.position.set(0, 0, 0);
    this.globeGroup.add(this.sunLight);
    this.globeGroup.add(this.sunLight.target);

    this.sunLight.raycast = () => {};

    this.moonLight = new THREE.DirectionalLight(0x8899cc, MOON_INTENSITY);
    this.moonLight.position.set(-GLOBE_RADIUS * 2, MOON_ORBIT_TILT * GLOBE_RADIUS, 0);
    this.moonLight.target.position.set(0, 0, 0);
    this.globeGroup.add(this.moonLight);
    this.globeGroup.add(this.moonLight.target);
    this.moonLight.raycast = () => {};

    const moonGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xddeeff });
    this.moonOrb = new THREE.Mesh(moonGeo, moonMat);
    this.moonOrb.raycast = () => {};
    this.globeGroup.add(this.moonOrb);

    this.buildMeridianLine();

    onStateUpdate(() => this.onStateChange());
  }

  private buildMeridianLine(): void {
    const r = GLOBE_RADIUS;
    const extend = r * 0.15;
    const points: THREE.Vector3[] = [
      new THREE.Vector3(0, -(r + extend), 0),
      new THREE.Vector3(0, r + extend, 0),
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.45,
    });
    const line = new THREE.Line(geom, mat);
    line.raycast = () => {};
    this.globeGroup.add(line);
  }

  private onStateChange(): void {
    this.updateCityGlowLights();
  }

  update(): void {
    const sunAngle = clientState.sunAngle;
    if (sunAngle === this.lastSunAngle) return;
    this.lastSunAngle = sunAngle;

    const moonAngle = sunAngle + Math.PI;

    this.sunLight.position.set(
      GLOBE_RADIUS * 2 * Math.cos(sunAngle),
      0,
      GLOBE_RADIUS * 2 * Math.sin(sunAngle),
    );
    this.sunLight.target.position.set(0, 0, 0);

    this.moonLight.position.set(
      GLOBE_RADIUS * 2 * Math.cos(moonAngle),
      MOON_ORBIT_TILT * GLOBE_RADIUS,
      GLOBE_RADIUS * 2 * Math.sin(moonAngle),
    );
    this.moonLight.target.position.set(0, 0, 0);

    this.moonOrb.position.set(
      MOON_ORBIT_RADIUS * GLOBE_RADIUS * Math.cos(moonAngle),
      MOON_ORBIT_TILT * GLOBE_RADIUS * 0.6,
      MOON_ORBIT_RADIUS * GLOBE_RADIUS * Math.sin(moonAngle),
    );

    const dayFactor = this.computeDayFactor(sunAngle);
    this.sunLight.intensity = THREE.MathUtils.lerp(0.3, CFG.DAY_NIGHT.SUN_INTENSITY, dayFactor);
    this.moonLight.intensity = THREE.MathUtils.lerp(MOON_INTENSITY, 0.02, dayFactor);

    this.ambientLight.intensity = THREE.MathUtils.lerp(
      CFG.DAY_NIGHT.AMBIENT_NIGHT_INTENSITY,
      CFG.DAY_NIGHT.AMBIENT_DAY_INTENSITY,
      dayFactor,
    );
    this.hemisphereLight.intensity = THREE.MathUtils.lerp(0.15, 0.5, dayFactor);

    this.applyTerminatorGradient(sunAngle);

    this.updateCityGlowIntensity(dayFactor);
  }

  private computeDayFactor(sunAngle: number): number {
    return 0.5 + 0.5 * Math.cos(sunAngle);
  }

  private getSunDirection(sunAngle: number): THREE.Vector3 {
    return new THREE.Vector3(
      Math.cos(sunAngle),
      0,
      Math.sin(sunAngle),
    ).normalize();
  }

  private applyTerminatorGradient(sunAngle: number): void {
    const sunDir = this.getSunDirection(sunAngle);

    for (const [cellId, mesh] of this.cellMeshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const pos = mesh.position.clone().normalize();
      const dot = pos.dot(sunDir);

      const nightFactor = THREE.MathUtils.smoothstep(-dot, -0.2, 0.3);
      const baseEmissive = nightFactor * CFG.DAY_NIGHT.NIGHT_COLOR_MIX;
      mat.emissive.copy(this.nightColor).multiplyScalar(baseEmissive);
      mat.emissiveIntensity = nightFactor > 0.01 ? 1.0 : 0.0;
    }
  }

  private updateCityGlowLights(): void {
    const currentCityIds = new Set<string>();

    for (const [cityId, city] of clientState.cities) {
      if (!clientState.visibleCells.has(city.cellId)) continue;
      currentCityIds.add(cityId);

      if (!this.cityGlowLights.has(cityId)) {
        const light = new THREE.PointLight(
          this.glowColor,
          CFG.DAY_NIGHT.CITY_GLOW_INTENSITY,
          GLOBE_RADIUS * 0.5,
          2,
        );
        light.raycast = () => {};

        const cellMesh = this.cellMeshes.get(city.cellId);
        if (cellMesh) {
          const normal = cellMesh.position.clone().normalize();
          light.position.copy(normal.multiplyScalar(GLOBE_RADIUS * 1.06));
        }

        this.globeGroup.add(light);
        this.cityGlowLights.set(cityId, light);
      }

      const existing = this.cityGlowLights.get(cityId)!;
      const cellMesh = this.cellMeshes.get(city.cellId);
      if (cellMesh) {
        const normal = cellMesh.position.clone().normalize();
        existing.position.copy(normal.multiplyScalar(GLOBE_RADIUS * 1.06));
      }
    }

    for (const [cityId, light] of this.cityGlowLights) {
      if (!currentCityIds.has(cityId)) {
        this.globeGroup.remove(light);
        light.dispose();
        this.cityGlowLights.delete(cityId);
      }
    }
  }

  private updateCityGlowIntensity(dayFactor: number): void {
    const nightFactor = 1.0 - dayFactor;
    const intensity = nightFactor * CFG.DAY_NIGHT.CITY_GLOW_INTENSITY;

    for (const [, light] of this.cityGlowLights) {
      light.intensity = intensity;
    }
  }
}