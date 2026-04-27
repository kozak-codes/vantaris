const CITY_NAMES = [
  'Ashford', 'Brambleton', 'Copperdale', 'Dunmore', 'Eastmere',
  'Foxglove', 'Greystone', 'Highwater', 'Ironvale', 'Juniper',
  'Kingsford', 'Lakewood', 'Millbrook', 'Northaven', 'Oakhaven',
  'Pinecrest', 'Quarryfield', 'Redstone', 'Silverbrook', 'Thornwall',
  'Undercliff', 'Vinewood', 'Westholm', 'Yellowleaf', 'Zephyr',
  'Alderford', 'Birchwood', 'Cinderpeak', 'Driftmark', 'Emberfall',
  'Frostgate', 'Goldhaven', 'Hearthstone', 'Ironforge', 'Jademere',
  'Knightswatch', 'Luminos', 'Marblehall', 'Nettlefield', 'Oldforge',
  'Pearlshore', 'Quickwater', 'Ravenscar', 'Stonewall', 'Twilight',
  'Umber', 'Verdantia', 'Whisperdale', 'Yarrow', 'Duskport',
];

let nameIndex = 0;
const usedNames = new Set<string>();

export function getNextCityName(): string {
  for (let i = 0; i < CITY_NAMES.length; i++) {
    const idx = (nameIndex + i) % CITY_NAMES.length;
    const name = CITY_NAMES[idx];
    if (!usedNames.has(name)) {
      usedNames.add(name);
      nameIndex = (idx + 1) % CITY_NAMES.length;
      return name;
    }
  }
  return `City ${nameIndex++ + 1}`;
}

export function releaseCityName(name: string): void {
  usedNames.delete(name);
}

export const CITY_NAME_LIST = CITY_NAMES;