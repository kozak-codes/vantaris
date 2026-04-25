import { clientState, onStateUpdate, addChatMessage } from '../state/ClientState';
import { sendChatMessage, sendDirectMessage, onChatMessage } from '../network/ColyseusClient';
import type { ChatMessage } from '@vantaris/shared';

export class ChatPanel {
  private container: HTMLElement;
  private messagesEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private tabGlobal: HTMLElement;
  private tabDirect: HTMLElement;
  private directTabsEl: HTMLElement;
  private lastMessageCount: number = 0;
  private lastPlayerHash: string = '';

  constructor() {
    this.container = document.getElementById('hud-chat')!;
    this.buildUI();
    this.messagesEl = this.container.querySelector('.chat-messages')!;
    this.inputEl = this.container.querySelector('.chat-input') as HTMLInputElement;
    this.tabGlobal = this.container.querySelector('.chat-tab-global')!;
    this.tabDirect = this.container.querySelector('.chat-tab-dm')!;
    this.directTabsEl = this.container.querySelector('.chat-dm-tabs')!;

    this.bindEvents();

    onChatMessage((msg) => {
      addChatMessage(msg);
      this.renderTabs();
      this.renderMessages();
    });

    onStateUpdate(() => {
      const playerHash = this.computePlayerHash();
      if (playerHash !== this.lastPlayerHash) {
        this.lastPlayerHash = playerHash;
        this.renderTabs();
      }
    });
  }

  show(): void {
    this.container.classList.remove('hidden');
    this.container.classList.add('chat-open');
  }

  hide(): void {
    this.container.classList.remove('chat-open');
    this.container.classList.add('hidden');
  }

  toggle(): void {
    if (this.container.classList.contains('chat-open')) {
      this.hide();
    } else {
      this.show();
    }
  }

  openDirectMessage(playerId: string): void {
    clientState.chatTab = playerId;
    clientState.chatUnreadDirect.set(playerId, 0);
    this.lastMessageCount = -1;
    this.renderTabs();
    this.renderMessages();
    this.show();
    this.inputEl.focus();
  }

  private buildUI(): void {
    this.container.innerHTML = `
      <div class="chat-header">
        <button class="chat-tab chat-tab-global active">Global</button>
        <button class="chat-tab chat-tab-dm">Direct</button>
        <span class="chat-unread-global"></span>
      </div>
      <div class="chat-dm-tabs"></div>
      <div class="chat-messages"></div>
      <input class="chat-input" type="text" placeholder="Send message..." maxlength="200" />
    `;
  }

  private bindEvents(): void {
    this.tabGlobal.addEventListener('click', () => {
      clientState.chatTab = 'global';
      clientState.chatUnreadGlobal = 0;
      this.lastMessageCount = -1;
      this.renderTabs();
      this.renderMessages();
      this.inputEl.focus();
    });

    this.tabDirect.addEventListener('click', () => {
      const dmPartners = this.getDmPartners();
      if (dmPartners.length > 0 && typeof clientState.chatTab === 'string' && clientState.chatTab !== 'global') {
        // stay on current DM
      } else if (dmPartners.length > 0) {
        clientState.chatTab = dmPartners[0];
        clientState.chatUnreadDirect.set(dmPartners[0], 0);
      }
      this.lastMessageCount = -1;
      this.renderTabs();
      this.renderMessages();
      this.inputEl.focus();
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sendMessage();
      }
      e.stopPropagation();
    });

    this.inputEl.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });
  }

  private sendMessage(): void {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = '';

    const tab = clientState.chatTab;
    if (tab === 'global') {
      sendChatMessage(text);
    } else {
      sendDirectMessage(tab, text);
    }
  }

  private getDmPartners(): string[] {
    const partners = new Set<string>();
    for (const msg of clientState.chatMessages) {
      if (msg.targetId) {
        const partner = msg.senderId === clientState.myPlayerId ? msg.targetId : msg.senderId;
        partners.add(partner);
      }
    }
    return [...partners];
  }

  private computePlayerHash(): string {
    let h = '';
    for (const [, p] of clientState.players) {
      h += `${p.playerId},${p.alive}|`;
    }
    return h;
  }

  renderTabs(): void {
    const tab = clientState.chatTab;
    this.tabGlobal.classList.toggle('active', tab === 'global');
    this.tabDirect.classList.toggle('active', tab !== 'global');

    const globalUnread = clientState.chatUnreadGlobal;
    const globalBadge = this.container.querySelector('.chat-unread-global')!;
    if (globalUnread > 0) {
      globalBadge.textContent = String(globalUnread);
      globalBadge.classList.remove('hidden');
    } else {
      globalBadge.classList.add('hidden');
    }

    const partners = this.getDmPartners();
    this.directTabsEl.innerHTML = '';
    if (tab !== 'global' || partners.length > 0) {
      for (const pid of partners) {
        const player = clientState.players.get(pid);
        const name = player ? player.displayName : pid.slice(0, 8);
        const unread = clientState.chatUnreadDirect.get(pid) || 0;
        const isActive = tab === pid;
        const btn = document.createElement('button');
        btn.className = 'chat-dm-tab' + (isActive ? ' active' : '');
        btn.innerHTML = name + (unread > 0 ? ` <span class="chat-dm-badge">${unread}</span>` : '');
        btn.addEventListener('click', () => {
          clientState.chatTab = pid;
          clientState.chatUnreadDirect.set(pid, 0);
          this.renderTabs();
          this.renderMessages();
          this.inputEl.focus();
        });
        this.directTabsEl.appendChild(btn);
      }
    }
  }

  renderMessages(): void {
    if (clientState.chatMessages.length === this.lastMessageCount) return;
    this.lastMessageCount = clientState.chatMessages.length;

    const tab = clientState.chatTab;

    const filtered = clientState.chatMessages.filter((msg) => {
      if (tab === 'global') {
        return msg.targetId === null;
      }
      if (msg.targetId === null) return false;
      const partner = msg.senderId === clientState.myPlayerId ? msg.targetId : msg.senderId;
      return partner === tab;
    });

    let html = '';
    for (const msg of filtered) {
      const isOwn = msg.senderId === clientState.myPlayerId;
      const cls = isOwn ? 'chat-msg chat-msg-own' : 'chat-msg chat-msg-other';
      html += `<div class="${cls}">
        <span class="chat-msg-name" style="color:${msg.senderColor}">${msg.senderName}</span>
        <span class="chat-msg-text">${this.escapeHtml(msg.text)}</span>
      </div>`;
    }

    this.messagesEl.innerHTML = html;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}