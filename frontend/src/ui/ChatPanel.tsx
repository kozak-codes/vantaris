import { FunctionalComponent } from 'preact';
import { useSignal } from '@preact/signals';
import { myPlayerId, chatMessages, chatTab, chatUnreadGlobal, chatUnreadDirect, players } from '../state/signals';
import { sendChatMessage, sendDirectMessage } from '../network/ColyseusClient';

export const ChatPanel: FunctionalComponent = () => {
  const open = useSignal(false);
  const inputRef = useSignal<HTMLInputElement | null>(null);
  const tab = chatTab.value;
  const msgs = chatMessages.value;

  const filtered = msgs.filter((msg) => {
    if (tab === 'global') return msg.targetId === null;
    if (msg.targetId === null) return false;
    const partner = msg.senderId === myPlayerId.value ? msg.targetId : msg.senderId;
    return partner === tab;
  });

  const dmPartners = new Set<string>();
  for (const msg of msgs) {
    if (msg.targetId) {
      const partner = msg.senderId === myPlayerId.value ? msg.targetId : msg.senderId;
      dmPartners.add(partner);
    }
  }

  const sendMessage = () => {
    const input = inputRef.value;
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    if (tab === 'global') {
      sendChatMessage(text);
    } else {
      sendDirectMessage(tab, text);
    }
  };

  return (
    <>
      <button id="hud-chat-toggle" title="Chat" onClick={() => { open.value = !open.value; }}>♦</button>
      {open.value && (
        <div id="hud-chat" class="chat-open">
          <div class="chat-header">
            <button class={`chat-tab chat-tab-global${tab === 'global' ? ' active' : ''}`} onClick={() => { chatTab.value = 'global'; chatUnreadGlobal.value = 0; }}>Global</button>
            <button class={`chat-tab chat-tab-dm${tab !== 'global' ? ' active' : ''}`}>Direct</button>
            {chatUnreadGlobal.value > 0 && <span class="chat-unread-global">{chatUnreadGlobal.value}</span>}
          </div>
          {(tab !== 'global' || dmPartners.size > 0) && (
            <div class="chat-dm-tabs">
              {[...dmPartners].map(pid => {
                const player = players.value.get(pid);
                const name = player ? player.displayName : pid.slice(0, 8);
                const unread = chatUnreadDirect.value.get(pid) || 0;
                const isActive = tab === pid;
                return (
                  <button class={`chat-dm-tab${isActive ? ' active' : ''}`} onClick={() => { chatTab.value = pid; const m = new Map(chatUnreadDirect.value); m.set(pid, 0); chatUnreadDirect.value = m; }}>
                    {name}{unread > 0 ? ` ${unread}` : ''}
                  </button>
                );
              })}
            </div>
          )}
          <div class="chat-messages">
            {filtered.map(msg => {
              const isOwn = msg.senderId === myPlayerId.value;
              const cls = isOwn ? 'chat-msg chat-msg-own' : 'chat-msg chat-msg-other';
              return (
                <div class={cls}>
                  <span class="chat-msg-name" style={{ color: msg.senderColor }}>{msg.senderName}</span>
                  <span class="chat-msg-text">{msg.text}</span>
                </div>
              );
            })}
          </div>
          <input
            ref={(el: any) => { inputRef.value = el; }}
            class="chat-input"
            type="text"
            placeholder="Send message..."
            maxlength={200}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
              e.stopPropagation();
            }}
            onKeyUp={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};