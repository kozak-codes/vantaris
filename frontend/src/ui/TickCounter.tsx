import { FunctionalComponent } from 'preact';
import { currentTick, sunAngle, dayNightCycleTicks, connected, lastTickTime } from '../state/signals';

export const TickCounter: FunctionalComponent = () => {
  const tick = currentTick.value;
  const p = ((sunAngle.value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const isNight = Math.cos(p) < 0;
  const icon = isNight ? '☽' : '☀';
  const isConn = connected.value;
  const timeSinceTick = Date.now() - lastTickTime.value;
  const isStale = isConn && timeSinceTick > 10000;

  let statusDot = '';
  let statusClass = 'hud-conn-ok';
  if (!isConn) {
    statusDot = '●';
    statusClass = 'hud-conn-disconnected';
  } else if (isStale) {
    statusDot = '●';
    statusClass = 'hud-conn-stale';
  }

  return <div id="hud-tick" class="hud-tick">{icon} Tick: {tick} <span class={statusClass}>{statusDot}</span></div>;
};