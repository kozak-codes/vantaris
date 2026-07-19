import { OrbitalBodyState } from '../state/OrbitalBodyState';
import { GameState } from '../state/GameState';

// Solve Kepler's equation M = E - e·sin(E) for eccentric anomaly E.
function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let E = meanAnomaly;
  for (let i = 0; i < 8; i++) {
    E = E - (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E));
  }
  return E;
}

// Compute a body's position relative to its parent body in km.
export function orbitalPositionRelParent(body: OrbitalBodyState): { x: number; y: number; z: number } {
  const el = body.elements;
  if (!el.parent) return { x: 0, y: 0, z: 0 };

  const M = el.meanAnomalyAtEpoch;
  const E = solveKepler(M, el.eccentricity);

  // Position in the orbital plane (perifocal frame).
  const a = el.semiMajorAxis;
  const x_pf = a * (Math.cos(E) - el.eccentricity);
  const y_pf = a * Math.sqrt(1 - el.eccentricity * el.eccentricity) * Math.sin(E);

  // Rotate by argument of periapsis (ω), inclination (i), and longitude of ascending node (Ω).
  const cosW = Math.cos(el.argumentOfPeriapsis);
  const sinW = Math.sin(el.argumentOfPeriapsis);
  const cosI = Math.cos(el.inclination);
  const sinI = Math.sin(el.inclination);
  const cosO = Math.cos(el.longitudeOfAscendingNode);
  const sinO = Math.sin(el.longitudeOfAscendingNode);

  const x = (cosO * cosW - sinO * sinW * cosI) * x_pf + (-cosO * sinW - sinO * cosW * cosI) * y_pf;
  const y = (sinO * cosW + cosO * sinW * cosI) * x_pf + (-sinO * sinW + cosO * cosW * cosI) * y_pf;
  const z = (sinW * sinI) * x_pf + (cosW * sinI) * y_pf;

  return { x, y, z };
}

// Recursively compute absolute (star-relative) positions for all bodies.
// Bodies with a parent inherit their parent's absolute position.
export function updateOrbitalPositions(state: GameState): void {
  const resolved = new Set<string>();

  function resolve(bodyId: string): { x: number; y: number; z: number } {
    if (resolved.has(bodyId)) {
      const b = state.orbitalBodies.get(bodyId);
      if (!b) return { x: 0, y: 0, z: 0 };
      return { x: b.posX, y: b.posY, z: b.posZ };
    }
    const body = state.orbitalBodies.get(bodyId);
    if (!body) return { x: 0, y: 0, z: 0 };

    if (body.landedCellId) {
      // Landed bodies sit on their parent planet's surface — approximated as the planet center
      // since cell-local surface offsets are below the rendering precision needed at system scale.
      const parentPos = body.elements.parent ? resolve(body.elements.parent) : { x: 0, y: 0, z: 0 };
      body.posX = parentPos.x;
      body.posY = parentPos.y;
      body.posZ = parentPos.z;
      resolved.add(bodyId);
      return parentPos;
    }

    if (body.descending) {
      // Descending bodies have their position lerped each tick by the room
      // (see VantarisRoom.tickDescent). Skip the Kepler update so we don't
      // clobber the in-progress animation.
      resolved.add(bodyId);
      return { x: body.posX, y: body.posY, z: body.posZ };
    }

    const rel = orbitalPositionRelParent(body);
    const parentPos = body.elements.parent ? resolve(body.elements.parent) : { x: 0, y: 0, z: 0 };
    const x = rel.x + parentPos.x;
    const y = rel.y + parentPos.y;
    const z = rel.z + parentPos.z;
    body.posX = x;
    body.posY = y;
    body.posZ = z;
    resolved.add(bodyId);
    return { x, y, z };
  }

  for (const [bodyId] of state.orbitalBodies) {
    resolve(bodyId);
  }
}

// Advance the mean anomaly of each body by the elapsed time.
export function advanceOrbitalAnomalies(state: GameState, deltaSeconds: number): void {
  for (const [, body] of state.orbitalBodies) {
    if (body.landedCellId) continue;
    if (body.descending) continue; // descent is a lerp, not a Kepler orbit
    const el = body.elements;
    if (!el.parent || el.period <= 0) continue;
    const n = (Math.PI * 2) / el.period; // mean motion
    el.meanAnomalyAtEpoch = (el.meanAnomalyAtEpoch + n * deltaSeconds) % (Math.PI * 2);
  }
}