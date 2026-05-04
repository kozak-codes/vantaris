import { FunctionalComponent } from 'preact';
import { economyOpen } from './ResourceBar';
import { resources, myPlayerId, units } from '../state/signals';
import { sendSetClaimCompensation } from '../network/ColyseusClient';
import { CFG } from '@vantaris/shared';
import { typeLabel } from './hud-shared';

export const EconomyDialog: FunctionalComponent = () => {
  if (!economyOpen.value || !myPlayerId.value) return <></>;
  const r = resources.value;
  const pid = myPlayerId.value;

  let totalCitizenWealth = 0;
  let citizenCount = 0;
  const citizenRows: any[] = [];
  for (const [, u] of units.value) {
    if (u.ownerId === pid) {
      totalCitizenWealth += u.energyCredits;
      citizenCount++;
      const unitCfg = CFG.UNITS[u.type];
      const maxW = unitCfg?.maxWeight ?? 0;
      citizenRows.push(
        <div class="economy-citizen-row">
          <span class="economy-citizen-name">{u.name || typeLabel(u.type)}</span>
          <span class="economy-citizen-type">{typeLabel(u.type)}</span>
          <span class="economy-citizen-credits">⚡{Math.round(u.energyCredits)}</span>
          {maxW > 0 && <span class="economy-citizen-weight">{u.inventoryWeight}/{maxW}</span>}
        </div>
      );
    }
  }

  const avgWealth = citizenCount > 0 ? Math.round(totalCitizenWealth / citizenCount) : 0;

  return (
    <div class="dialog-overlay" onClick={() => { economyOpen.value = false; }}>
      <div class="dialog economy-dialog" onClick={(e) => { e.stopPropagation(); }}>
        <div class="dialog-header">
          <span class="dialog-title">Economy</span>
          <button class="dialog-close" onClick={() => { economyOpen.value = false; }}>&times;</button>
        </div>
        <div class="dialog-body">
          <div class="panel-section">
            <div class="panel-subtitle">Empire Treasury</div>
            <div class="panel-row"><span class="label">Energy Credits</span><span>⚡ {Math.round(r.energyCredits)}</span></div>
            <div class="panel-row"><span class="label">Income</span><span>+{Math.round(r.energyPerTick)}/t</span></div>
          </div>
          <div class="panel-section">
            <div class="panel-subtitle">Policy</div>
            <div class="panel-row"><span class="label">Claim Compensation</span><span class="economy-setting">
              <input type="number" class="economy-input" value={r.claimCompensation} min={0} step={1}
                onInput={(e: any) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) sendSetClaimCompensation(v); }}
              />
              <span class="economy-unit">⚡/claim</span>
            </span></div>
          </div>
          <div class="panel-section">
            <div class="panel-subtitle">Citizen Wealth</div>
            <div class="panel-row"><span class="label">Total</span><span>⚡ {Math.round(totalCitizenWealth)}</span></div>
            <div class="panel-row"><span class="label">Average</span><span>⚡ {avgWealth}/unit</span></div>
            <div class="panel-row"><span class="label">Citizens</span><span>{citizenCount}</span></div>
          </div>
          {citizenRows.length > 0 && (
            <div class="panel-section economy-citizen-list">
              {citizenRows}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};