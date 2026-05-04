import { signal } from '@preact/signals';
import { FunctionalComponent } from 'preact';
import { myPlayerId, resources } from '../state/signals';

export const economyOpen = signal<boolean>(false);

export const ResourceBar: FunctionalComponent = () => {
  const pid = myPlayerId.value;
  if (!pid) return <div id="hud-resources" class="hud-resources hidden" />;
  const r = resources.value;
  return (
    <div id="hud-resources" class="hud-resources" onClick={() => { economyOpen.value = true; }} title="Click to open Economy">
      <div class="res-item energy-credits-item"><span class="res-icon energy-icon">⚡</span><span class="res-val">{Math.round(r.energyCredits)}</span><span class="res-rate">+{Math.round(r.energyPerTick)}/t</span></div>
    </div>
  );
};