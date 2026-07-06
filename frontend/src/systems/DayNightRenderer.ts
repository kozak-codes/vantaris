import * as THREE from 'three';
import { clientState, onStateUpdate } from '../state/ClientState';
import { GLOBE_RADIUS } from './IconFactory';
import { CFG } from '@vantaris/shared';
import { orbitalBodies } from '../state/signals';

const MOON_INTENSITY = CFG.DAY_NIGHT.MOON_INTENSITY;
const MOON_ORBIT_TILT = CFG.DAY_NIGHT.MOON_ORBIT_TILT;
const MOON_ORBIT_RADIUS = CFG.DAY_NIGHT.MOON_ORBIT_RADIUS;
// The sun sits far away in the planet view; the directional light matches this direction.
const SUN_RENDER_DISTANCE = CFG.DAY_NIGHT.SUN_RENDER_DISTANCE;

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
  private sunOrb: THREE.Mesh;
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

    // A small emissive sphere placed far from the planet in the sun's direction,
    // so the player can see where the sun is in the sky from the planet view.
    const sunGeo = new THREE.SphereGeometry(2.0, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff0cc });
    this.sunOrb = new THREE.Mesh(sunGeo, sunMat);
    this.sunOrb.raycast = () => {};
    this.globeGroup.add(this.sunOrb);

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
    if (sunAngle === this.lastSunAngle && !this.hasOrbitalSun()) return;
    this.lastSunAngle = sunAngle;

    // Direction from the planet to the sun, in globe-local space. Prefer the
    // real orbital positions; fall back to the day/night cycle angle.
    const sunDir = this.getSunDirectionFromOrbit(sunAngle);

    this.sunLight.position.copy(sunDir).multiplyScalar(SUN_RENDER_DISTANCE);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunOrb.position.copy(sunDir).multiplyScalar(SUN_RENDER_DISTANCE);

    // Moon position from real orbital data (Selene). Falls back to the legacy
    // day/night cycle angle if no orbital moon is present.
    const moonDir = this.getMoonDirectionFromOrbit(sunAngle);
    this.moonLight.position.copy(moonDir).multiplyScalar(GLOBE_RADIUS * 2);
    this.moonLight.target.position.set(0, 0, 0);
    this.moonOrb.position.copy(moonDir).multiplyScalar(MOON_ORBIT_RADIUS * GLOBE_RADIUS);

    // Day factor follows the real sun direction (dot of sun dir with the globe's
    // local +x axis, which is where the camera looks by default).
    const dayFactor = this.computeDayFactor(sunDir);
    this.sunLight.intensity = THREE.MathUtils.lerp(0.3, CFG.DAY_NIGHT.SUN_INTENSITY, dayFactor);
    this.moonLight.intensity = THREE.MathUtils.lerp(MOON_INTENSITY, 0.02, dayFactor);

    this.ambientLight.intensity = THREE.MathUtils.lerp(
      CFG.DAY_NIGHT.AMBIENT_NIGHT_INTENSITY,
      CFG.DAY_NIGHT.AMBIENT_DAY_INTENSITY,
      dayFactor,
    );
    this.hemisphereLight.intensity = THREE.MathUtils.lerp(0.15, 0.5, dayFactor);

    this.applyTerminatorGradient(sunDir);

    this.updateCityGlowIntensity(dayFactor);
  }

  private hasOrbitalSun(): boolean {
    const bodies = orbitalBodies.value;
    if (bodies.size === 0) return false;
    for (const [, b] of bodies) {
      if (b.type === 'STAR') return true;
    }
    return false;
  }

  // Returns the sun's direction relative to the planet in globe-local space.
  // The globe group is rotated by the player's camera, so we express the sun
  // direction in the globe's local frame: the star's world position minus the
  // planet's world position, normalized, rotated into the globe's local frame.
  private getSunDirectionFromOrbit(fallbackAngle: number): THREE.Vector3 {
    const bodies = orbitalBodies.value;
    let starPos: THREE.Vector3 | null = null;
    let planetPos: THREE.Vector3 | null = null;
    for (const [, b] of bodies) {
      if (b.type === 'STAR') starPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
      if (b.bodyId === 'vantaris') planetPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
    }
    if (!starPos || !planetPos) {
      // Fall back to the day/night cycle angle.
      return new THREE.Vector3(Math.cos(fallbackAngle), 0, Math.sin(fallbackAngle)).normalize();
    }
    // Direction from planet to star, in world (system) space.
    const worldDir = starPos.clone().sub(planetPos).normalize();
    // The orbital plane is the system's xz plane; map system world to globe-local.
    // The globe group sits at the origin with no rotation by default, so the
    // system's x/z axes map to the globe's local x/z. The system's y (out of plane)
    // maps to the globe's local y.
    return worldDir.normalize();
  }

  // Returns the moon's direction relative to the planet in globe-local space,
  // using real orbital data from Selene. Falls back to the legacy day/night
  // cycle angle if no orbital moon is present.
  private getMoonDirectionFromOrbit(fallbackAngle: number): THREE.Vector3 {
    const bodies = orbitalBodies.value;
    let moonPos: THREE.Vector3 | null = null;
    let planetPos: THREE.Vector3 | null = null;
    for (const [, b] of bodies) {
      if (b.type === 'MOON') moonPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
      if (b.type === 'PLANET') planetPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
    }
    if (!moonPos || !planetPos) {
      // Fall back to the legacy cycle angle (opposite the sun, with a tilt).
      const moonAngle = fallbackAngle + Math.PI;
      return new THREE.Vector3(
        Math.cos(moonAngle),
        MOON_ORBIT_TILT,
        Math.sin(moonAngle),
      ).normalize();
    }
    // Direction from planet to moon, in world (system) space.
    return moonPos.clone().sub(planetPos).normalize();
  }

  private computeDayFactor(sunDir: THREE.Vector3): number {
    // "Day" when the sun is on the camera-facing side of the globe. The globe's
    // default-facing normal is +z (camera looks down -z), so day = sunDir.z > 0.
    return 0.5 + 0.5 * sunDir.z;
  }

  private applyTerminatorGradient(sunDir: THREE.Vector3): void {
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