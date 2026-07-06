import { FunctionalComponent } from 'preact';
import { useComputed } from '@preact/signals';
import { orbitalBodies, myPlayerId, selectedTileId, selectedCellData } from '../state/signals';
import type { OrbitalBodyData } from '@vantaris/shared';
import type { WindowContentDescriptor } from '../state/windows';

function fmtKm(km: number): string {
  if (km >= 1e6) return `${(km / 1e6).toFixed(2)} Mkm`;
  if (km >= 1e3) return `${(km / 1e3).toFixed(1)} kkm`;
  return `${km.toFixed(0)} km`;
}

function fmtPeriod(s: number): string {
  if (s >= 86400) return `${(s / 86400).toFixed(1)} days`;
  if (s >= 3600) return `${(s / 3600).toFixed(1)} hours`;
  if (s >= 60) return `${(s / 60).toFixed(1)} min`;
  return `${s.toFixed(0)} s`;
}

const WinRow: FunctionalComponent<{ label: string; value: string }> = ({ label, value }) => (
  <div class="win-row"><span>{label}</span><span>{value}</span></div>
);

const WinSection: FunctionalComponent<{ title: string }> = ({ title }) => (
  <div class="win-section-title">{title}</div>
);

export const StarWindowContent: FunctionalComponent<{ bodyId: string }> = ({ bodyId }) => {
  const body = orbitalBodies.value.get(bodyId);
  if (!body) return null;
  const childCount = [...orbitalBodies.value.values()].filter((b) => b.elements.parent === bodyId).length;
  return (
    <div class="win-content">
      <WinRow label="Type" value="Star (G-class)" />
      <WinRow label="Mass" value={`${(body.mass / 1.989e30).toFixed(2)} M☉`} />
      <WinRow label="Radius" value={fmtKm(body.radius)} />
      <WinRow label="Children" value={`${childCount}`} />
    </div>
  );
};

export const PlanetWindowContent: FunctionalComponent<{ bodyId: string }> = ({ bodyId }) => {
  const body = orbitalBodies.value.get(bodyId);
  if (!body) return null;
  const children = useComputed(() =>
    [...orbitalBodies.value.values()].filter((b) => b.elements.parent === bodyId),
  );
  return (
    <div class="win-content">
      <WinRow label="Type" value="Planet" />
      <WinRow label="Mass" value={`${(body.mass / 5.972e24).toFixed(2)} M⊕`} />
      <WinRow label="Radius" value={fmtKm(body.radius)} />
      <WinRow label="Orbit" value={fmtKm(body.elements.semiMajorAxis)} />
      <WinRow label="Period" value={fmtPeriod(body.elements.period)} />
      <WinRow label="Eccentricity" value={body.elements.eccentricity.toFixed(4)} />
      <WinSection title={`Satellites (${children.value.length})`} />
      {children.value.map((c) => (
        <WinRow key={c.bodyId} label={c.name} value={c.type} />
      ))}
    </div>
  );
};

export const MoonWindowContent: FunctionalComponent<{ bodyId: string }> = ({ bodyId }) => {
  const body = orbitalBodies.value.get(bodyId);
  if (!body) return null;
  return (
    <div class="win-content">
      <WinRow label="Type" value="Moon" />
      <WinRow label="Mass" value={`${(body.mass / 7.342e22).toFixed(2)} M☾`} />
      <WinRow label="Radius" value={fmtKm(body.radius)} />
      <WinRow label="Orbit" value={fmtKm(body.elements.semiMajorAxis)} />
      <WinRow label="Period" value={fmtPeriod(body.elements.period)} />
      <WinRow label="Inclination" value={`${(body.elements.inclination * 180 / Math.PI).toFixed(1)}°`} />
    </div>
  );
};

export const SpacecraftWindowContent: FunctionalComponent<{ bodyId: string }> = ({ bodyId }) => {
  const body = orbitalBodies.value.get(bodyId);
  if (!body) return null;
  const isOwn = body.ownerId === myPlayerId.value;
  return (
    <div class="win-content">
      <WinRow label="Type" value="Spacecraft" />
      <WinRow label="Owner" value={isOwn ? 'You' : body.ownerId} />
      <WinRow label="Status" value={body.landedCellId ? 'Landed' : 'Orbiting'} />
      {body.landedCellId && <WinRow label="Cell" value={body.landedCellId} />}
      <WinRow label="Mass" value={`${(body.mass / 1000).toFixed(0)} t`} />
      <WinRow label="Orbit" value={fmtKm(body.elements.semiMajorAxis)} />
      <WinRow label="Period" value={fmtPeriod(body.elements.period)} />
      <WinRow label="Fuel" value={`${Math.round(body.fuel)} / ${Math.round(body.fuelCapacity)}`} />
    </div>
  );
};

export const TileWindowContent: FunctionalComponent<{ cellId?: string }> = () => {
  const cellData = selectedCellData.value;
  if (!cellData) return <div class="win-content"><div class="win-row">No tile selected</div></div>;
  return (
    <div class="win-content">
      <WinRow label="Cell" value={selectedTileId.value ?? ''} />
      <WinRow label="Biome" value={cellData.biome} />
      <WinRow label="Owner" value={cellData.ownerId || 'Unclaimed'} />
      <WinRow label="Elevation" value={cellData.elevation.toFixed(2)} />
      <WinRow label="Moisture" value={cellData.moisture.toFixed(2)} />
      <WinRow label="Temp" value={`${cellData.temperature.toFixed(1)}°C`} />
    </div>
  );
};

// Helper to create a window content descriptor for an orbital body.
export function bodyWindowContent(body: OrbitalBodyData): WindowContentDescriptor {
  switch (body.type) {
    case 'STAR':
      return { component: StarWindowContent, props: { bodyId: body.bodyId } };
    case 'PLANET':
      return { component: PlanetWindowContent, props: { bodyId: body.bodyId } };
    case 'MOON':
      return { component: MoonWindowContent, props: { bodyId: body.bodyId } };
    default:
      return { component: SpacecraftWindowContent, props: { bodyId: body.bodyId } };
  }
}