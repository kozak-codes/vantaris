import { FunctionalComponent } from 'preact';
import { useSignal, useSignalEffect } from '@preact/signals';
import { eliminationEvent, gameWonEvent } from '../state/signals';

export const EliminationOverlay: FunctionalComponent = () => {
  const evt = useSignal<{ color: string; displayName: string; eliminatedTick: number; type: 'eliminated' | 'won' } | null>(null);
  const visible = useSignal(false);

  useSignalEffect(() => {
    const elimEvt = eliminationEvent.value;
    const wonEvt = gameWonEvent.value;
    if (elimEvt) {
      evt.value = { ...elimEvt, type: 'eliminated' };
      visible.value = true;
      eliminationEvent.value = null;
      setTimeout(() => { visible.value = false; }, 4000);
    }
    if (wonEvt) {
      evt.value = { color: wonEvt.color, displayName: wonEvt.displayName, eliminatedTick: 0, type: 'won' };
      visible.value = true;
      gameWonEvent.value = null;
      setTimeout(() => { visible.value = false; }, 4000);
    }
  });

  if (!evt.value || !visible.value) return <div id="hud-elimination" class="hidden" />;
  const e = evt.value;

  return (
    <div id="hud-elimination" class="elim-show">
      <div class="elim-border">
        <div class="elim-header">CHANNEL 66 &nbsp;|&nbsp; VANTARIS TOURNAMENT</div>
        <div class="elim-title">{e.type === 'won' ? 'WINNER DECLARED' : 'CONTESTANT ELIMINATED'}</div>
        <div class="elim-name" style={{ color: e.color }}>{e.displayName}</div>
        {e.type === 'eliminated' && <div class="elim-survived">Survived {e.eliminatedTick} ticks</div>}
      </div>
    </div>
  );
};