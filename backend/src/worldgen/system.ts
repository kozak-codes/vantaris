import { OrbitalBodyType, CFG } from '@vantaris/shared';
import { GameState } from '../state/GameState';
import { OrbitalBodyState, OrbitalElementsState } from '../state/OrbitalBodyState';

let bodyIdCounter = 0;

function nextBodyId(prefix: string): string {
  return `${prefix}_${bodyIdCounter++}`;
}

function addStar(state: GameState): string {
  const o = CFG.ORBITAL;
  const body = new OrbitalBodyState();
  body.bodyId = nextBodyId('star');
  body.name = 'Vantaris Prime';
  body.type = OrbitalBodyType.STAR;
  body.mass = o.STAR_MASS;
  body.radius = o.STAR_RADIUS;
  body.elements = new OrbitalElementsState();
  state.orbitalBodies.set(body.bodyId, body);
  return body.bodyId;
}

function addVantaris(state: GameState, starId: string): string {
  const o = CFG.ORBITAL;
  const body = new OrbitalBodyState();
  body.bodyId = 'vantaris';
  body.name = 'Vantaris';
  body.type = OrbitalBodyType.PLANET;
  body.mass = o.PLANET_MASS;
  body.radius = o.PLANET_RADIUS_KM;

  const elements = new OrbitalElementsState();
  elements.parent = starId;
  elements.semiMajorAxis = o.PLANET_SEMI_MAJOR_AXIS_KM;
  elements.eccentricity = o.PLANET_ECCENTRICITY;
  elements.inclination = 0;
  elements.longitudeOfAscendingNode = 0;
  elements.argumentOfPeriapsis = 0;
  elements.meanAnomalyAtEpoch = 0;
  elements.period = o.PLANET_PERIOD_S;
  body.elements = elements;

  state.orbitalBodies.set(body.bodyId, body);
  return body.bodyId;
}

function addMoon(state: GameState, parentId: string): string {
  const o = CFG.ORBITAL;
  const body = new OrbitalBodyState();
  body.bodyId = 'vantaris_moon';
  body.name = 'Selene';
  body.type = OrbitalBodyType.MOON;
  body.mass = o.MOON_MASS;
  body.radius = o.MOON_RADIUS_KM;

  const elements = new OrbitalElementsState();
  elements.parent = parentId;
  elements.semiMajorAxis = o.MOON_SEMI_MAJOR_AXIS_KM;
  elements.eccentricity = o.MOON_ECCENTRICITY;
  elements.inclination = o.MOON_INCLINATION;
  elements.longitudeOfAscendingNode = 0;
  elements.argumentOfPeriapsis = 0;
  elements.meanAnomalyAtEpoch = 0;
  elements.period = o.MOON_PERIOD_S;
  body.elements = elements;

  state.orbitalBodies.set(body.bodyId, body);
  return body.bodyId;
}

function addSpacecraft(
  state: GameState,
  ownerId: string,
  parentId: string,
  displayName: string,
): string {
  const o = CFG.ORBITAL;
  const body = new OrbitalBodyState();
  body.bodyId = nextBodyId('lander');
  body.name = `${displayName}'s Lander`;
  body.type = OrbitalBodyType.SPACECRAFT;
  body.ownerId = ownerId;
  body.mass = o.LANDER_MASS;
  body.radius = o.LANDER_RADIUS_KM;
  body.fuel = o.LANDER_FUEL_CAPACITY;
  body.fuelCapacity = o.LANDER_FUEL_CAPACITY;

  const elements = new OrbitalElementsState();
  elements.parent = parentId;
  elements.semiMajorAxis = o.LANDER_SEMI_MAJOR_AXIS_KM;
  elements.eccentricity = 0;
  elements.inclination = o.LANDER_INCLINATION;
  elements.longitudeOfAscendingNode = 0;
  elements.argumentOfPeriapsis = 0;
  elements.meanAnomalyAtEpoch = Math.random() * Math.PI * 2;
  elements.period = o.LANDER_PERIOD_S;
  body.elements = elements;

  state.orbitalBodies.set(body.bodyId, body);
  return body.bodyId;
}

export function generateStartingSystem(state: GameState): string {
  const starId = addStar(state);
  const vantarisId = addVantaris(state, starId);
  addMoon(state, vantarisId);
  return starId;
}

export function spawnPlayerSpacecraft(
  state: GameState,
  ownerId: string,
  displayName: string,
): string {
  return addSpacecraft(state, ownerId, 'vantaris', displayName);
}

export const LANDER_FUEL = CFG.ORBITAL.LANDER_FUEL_CAPACITY;