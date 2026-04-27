import { FunctionalComponent } from 'preact';
import { myPlayerId, resources, myUnitCount } from '../state/signals';

export const ResourceBar: FunctionalComponent = () => {
  const pid = myPlayerId.value;
  if (!pid) return <div id="hud-resources" class="hud-resources hidden" />;
  const r = resources.value;
  return (
    <div id="hud-resources" class="hud-resources">
      <div class="res-item"><span class="res-icon food-icon">☘</span><span class="res-val">{r.food}</span><span class="res-rate">+{r.foodPerTick}/t</span></div>
      <div class="res-item"><span class="res-icon energy-icon">⚡</span><span class="res-val">{r.energy}</span><span class="res-rate">+{r.energyPerTick}/t</span></div>
      <div class="res-sep"></div>
      <div class="res-item"><span class="res-icon pop-icon">⚑</span><span class="res-val">{r.totalPopulation}</span></div>
      <div class="res-item"><span class="res-icon factory-icon">⚙</span><span class="res-val">{r.factoryCount}</span></div>
      <div class="res-item"><span class="res-icon army-icon">⦿</span><span class="res-val">{myUnitCount.value}</span></div>
    </div>
  );
};