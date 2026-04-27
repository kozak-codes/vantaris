import { FunctionalComponent } from 'preact';
import { myPlayerId, sortedPlayers, chatTab, chatUnreadDirect } from '../state/signals';

export const PlayerList: FunctionalComponent = () => {
  const pid = myPlayerId.value;
  if (!pid) return <div id="hud-player-list" class="hidden" />;

  const plist = sortedPlayers.value;
  const dmCallback = (targetId: string) => {
    chatTab.value = targetId;
    const m = new Map(chatUnreadDirect.value);
    m.set(targetId, 0);
    chatUnreadDirect.value = m;
  };

  return (
    <div id="hud-player-list">
      <div class="plist-header">CONTESTANTS</div>
      {plist.map(p => {
        const isYou = p.playerId === pid;
        const dot = p.alive
          ? <span class="plist-dot" style={{ background: p.color }}></span>
          : <span class="plist-dot plist-dot-dead" style={{ borderColor: p.color }}></span>;
        const tag = isYou ? <span class="plist-you">[you]</span> : <></>;
        const deadTag = !p.alive ? <span class="plist-dead">[dead]</span> : <></>;
        const stats = p.alive ? <span class="plist-stats">{p.territoryCount}hex {p.cityCount}city {p.unitCount}mil</span> : <></>;
        const dmBtn = (!isYou && p.alive) ? <button class="plist-dm-btn" onClick={(e) => { e.stopPropagation(); dmCallback(p.playerId); }} title="Send direct message">✉</button> : <></>;
        return (
          <div class={`plist-row${!p.alive ? ' plist-row-dead' : ''}`}>
            {dot}
            <span class="plist-name">{p.displayName}{tag}{deadTag}</span>
            {dmBtn}
            {stats}
          </div>
        );
      })}
    </div>
  );
};