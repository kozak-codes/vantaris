import { FunctionalComponent } from 'preact';
import { currentTick, sunAngle, dayNightCycleTicks } from '../state/signals';

export const TickCounter: FunctionalComponent = () => {
  const tick = currentTick.value;
  const p = ((sunAngle.value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const isNight = Math.cos(p) < 0;
  const icon = isNight ? '☽' : '☀';
  return <div id="hud-tick" class="hud-tick">Tick: {tick}  {icon}</div>;
};