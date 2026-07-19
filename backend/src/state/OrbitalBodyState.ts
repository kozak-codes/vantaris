import { Schema, type } from '@colyseus/schema';
import { OrbitalBodyType } from '@vantaris/shared';

export class OrbitalElementsState extends Schema {
  @type('string') parent: string = '';
  @type('number') semiMajorAxis: number = 0;
  @type('number') eccentricity: number = 0;
  @type('number') inclination: number = 0;
  @type('number') longitudeOfAscendingNode: number = 0;
  @type('number') argumentOfPeriapsis: number = 0;
  @type('number') meanAnomalyAtEpoch: number = 0;
  @type('number') period: number = 0;
}

export class OrbitalBodyState extends Schema {
  @type('string') bodyId: string = '';
  @type('string') name: string = '';
  @type('string') type: OrbitalBodyType = OrbitalBodyType.PLANET;
  @type('string') ownerId: string = '';
  @type('number') mass: number = 0;
  @type('number') radius: number = 0;
  @type(OrbitalElementsState) elements = new OrbitalElementsState();
  @type('number') fuel: number = 0;
  @type('number') fuelCapacity: number = 0;
  @type('number') posX: number = 0;
  @type('number') posY: number = 0;
  @type('number') posZ: number = 0;
  @type('string') landedCellId: string = '';
  @type('number') landedSubHex: number = -1;
  // Descent animation state — set by the server when a lander is animating
  // from orbit to a chosen surface cell.
  @type('boolean') descending: boolean = false;
  @type('string') descentTargetCellId: string = '';
  @type('number') descentTicksRemaining: number = 0;
  // Non-replicated: world-space position (km, star-relative) at the start of
  // the descent animation. Used for lerp; not sent to clients.
  descentStartPosX: number = 0;
  descentStartPosY: number = 0;
  descentStartPosZ: number = 0;
  descentTotalTicks: number = 0;
  // Saved orbit to restore after landing (so the orbit line stays sensible).
  savedSemiMajorAxis: number = 0;
}