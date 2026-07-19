import { FunctionalComponent } from 'preact';
import { useComputed } from '@preact/signals';
import { orbitalBodies, myPlayerId, selectedTileId, selectedCellData, landingTargetBodyId, beginLandingTarget, cancelLandingTarget, landingError, enterPlanetView } from '../state/signals';
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
  const canLand = isOwn && !body.landedCellId && !body.descending;
  const isPickingTarget = landingTargetBodyId.value === bodyId;
  const isDescending = body.descending;
  const status = body.landedCellId ? 'Landed'
    : isDescending ? `Descending (${body.descentTicksRemaining})`
    : 'Orbiting';
  return (
    <div class="win-content">
      <WinRow label="Type" value="Spacecraft" />
      <WinRow label="Owner" value={isOwn ? 'You' : body.ownerId} />
      <WinRow label="Status" value={status} />
      {body.landedCellId && <WinRow label="Cell" value={body.landedCellId} />}
      {isDescending && body.descentTargetCellId && <WinRow label="Target" value={body.descentTargetCellId} />}
      <WinRow label="Mass" value={`${(body.mass / 1000).toFixed(0)} t`} />
      <WinRow label="Orbit" value={fmtKm(body.elements.semiMajorAxis)} />
      <WinRow label="Period" value={fmtPeriod(body.elements.period)} />
      <WinRow label="Fuel" value={`${Math.round(body.fuel)} / ${Math.round(body.fuelCapacity)}`} />
      {canLand && !isPickingTarget && (
        <button
          onClick={() => {
            // Switch to planet view of the lander's parent so the globe is
            // visible and clickable, then enter target-pick mode.
            enterPlanetView(body.elements.parent);
            beginLandingTarget(bodyId);
          }}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '8px 12px',
            cursor: 'pointer',
            background: '#3a6a3a',
            color: '#fff',
            border: '1px solid #5a8a5a',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '13px',
          }}
        >
          LAND
        </button>
      )}
      {isPickingTarget && (
        <>
          <div style={{ marginTop: '8px', padding: '8px', background: '#2a3a5a', border: '1px solid #4a6a8a', borderRadius: '4px', fontSize: '12px', color: '#cfe' }}>
            Click a tile on your lander's ground track to land there. Press Esc to cancel.
          </div>
          <button
            onClick={() => cancelLandingTarget()}
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '8px 12px',
              cursor: 'pointer',
              background: '#5a3a3a',
              color: '#fff',
              border: '1px solid #8a5a5a',
              borderRadius: '4px',
              fontWeight: 'bold',
              fontSize: '13px',
            }}
          >
            CANCEL
          </button>
        </>
      )}
      {landingError.value && (
        <div style={{ marginTop: '8px', padding: '6px 8px', background: '#5a2a2a', border: '1px solid #8a4a4a', borderRadius: '4px', fontSize: '12px', color: '#fcc' }}>
          {landingError.value}
        </div>
      )}
    </div>
  );
};

export const TileWindowContent: FunctionalComponent<{ cellId?: string }> = () => {
  const cellData = selectedCellData.value;
  if (!cellData) return <div class="win-content"><div class="win-row">No tile selected</div></div>;
  return (
    <div class="win-content">
      <WinRow label="Cell" value={selectedTileId.value ?? ''} />
      <WinRow label="Owner" value={cellData.ownerId || 'Unclaimed'} />
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