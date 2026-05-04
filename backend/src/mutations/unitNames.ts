const UNIT_FIRST_NAMES = [
  'Aldric', 'Brynn', 'Cassia', 'Damon', 'Elara',
  'Finn', 'Greta', 'Hale', 'Ivra', 'Joren',
  'Kira', 'Lysander', 'Maren', 'Nolan', 'Orla',
  'Percival', 'Quinn', 'Rhea', 'Silas', 'Theron',
  'Uma', 'Voss', 'Wren', 'Xara', 'Yorick',
];

const UNIT_LAST_NAMES = [
  'Ironhand', 'Stonefoot', 'Brightblade', 'Thornwall', 'Dawnforge',
  'Redshield', 'Greywind', 'Marshborn', 'Hearthfire', 'Ridgewalker',
  'Copperheart', 'Stormborn', 'Frosthold', 'Ashwalker', 'Goldvein',
  'Emberfell', 'Oakenshield', 'Riversong', 'Steelfist', 'Duskwhisper',
];

let nameIndex = 0;

export function getNextUnitName(): string {
  const first = UNIT_FIRST_NAMES[nameIndex % UNIT_FIRST_NAMES.length];
  const last = UNIT_LAST_NAMES[Math.floor(nameIndex / UNIT_FIRST_NAMES.length) % UNIT_LAST_NAMES.length];
  nameIndex++;
  return `${first} ${last}`;
}

export const UNIT_FIRST_NAME_LIST = UNIT_FIRST_NAMES;
export const UNIT_LAST_NAME_LIST = UNIT_LAST_NAMES;