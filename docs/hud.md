# HUD & UI — Broadcast Overlay

## Design Tone

The HUD should feel like a **live broadcast overlay** — clean, clinical, slightly futuristic. Think tournament scoreboard, not fantasy game UI. The planet is a stage. The players are contestants. Channel 66 is watching.

## Current Implementation

### Player List (right side panel)

Source: [`frontend/src/ui/HUD.ts`](../frontend/src/ui/HUD.ts)

```
┌─────────────────────────────┐
│  CONTESTANTS                │
├─────────────────────────────┤
│  ● Zara-7        [you]      │
│    7hex 1city 3mil          │
│  ● Mox-Rin                  │
│    3hex 1city 2mil          │
│  ○ Drethkal      [dead]     │
└─────────────────────────────┘
```

- Color indicator dot per player
- Your entry marked `[you]`
- Eliminated players shown with hollow dot and `[dead]` — sorted to bottom
- Stats: hex count, city count, military (unit) count
- Sorted: alive first (by territory descending), dead last
- HTML element: `#hud-player-list`
- No biome legend — tooltip is the only reference (per GDD)

### Hex Tooltip (hover, cursor-following)

- Cursor-following tooltip (offset 16px from cursor)
- Biome name
- Owner name (player color)
- Fog state (Visible / Revealed)
- Only shown for VISIBLE or REVEALED cells
- Driven by `clientState.hoveredCellId` which updates on pointer move

### HUD Panel (bottom center)

Source: [`frontend/src/ui/HUD.ts`](../frontend/src/ui/HUD.ts)

- Tile info panel (biome, owner, selected entity info)
- Unit action buttons (Move, Claim, Stop)
- City production toggle
- Suppress update pattern: click handlers set `suppressUpdate = true` to prevent DOM rebuild flicker during interactions

### Selection

- **Tile selection**: Click a hex cell to select it
- **Unit selection**: Click an infantry icon, or press 1 on a tile to select first idle unit
- **Selection indicators**:
  - Selected tile: hex ring outline
  - Selected unit: small white circle at unit's position
- Source: [`frontend/src/systems/SelectionRenderer.ts`](../frontend/src/systems/SelectionRenderer.ts)

### Hover States

- White: base hover
- Purple: move target (when a unit is selected and in move mode)
- Yellow: claim target
- Red: enemy/invalid target

### Input System

Source: [`frontend/src/input/GlobeInput.ts`](../frontend/src/input/GlobeInput.ts)

- Click to select entities on a tile
- Click-tile-with-entity-selected updates tile context without deselecting
- `pointerleave`/`pointerout` handlers clear `hoveredCellId`
- Auto-enter move mode when selecting own idle infantry

## Future: Full HUD Spec

### Player List (right side panel)

```
┌─────────────────────────────┐
│  CONTESTANTS                │
├─────────────────────────────┤
│  ● Zara-7        [you]      │
│  ● Mox-Rin                  │
│  ● The Pale One             │
│  ● Commander Vesh           │
│  ○ Drethkal      [dead]     │
└─────────────────────────────┘
```

- Color indicator dot per player
- Your entry marked `[you]`
- Eliminated players shown with hollow dot and `[dead]`
- Click opens Player Action Panel (chat, diplomacy, profile)

### Hex Tooltip (hover)

- Biome type and terrain type
- Owner (if claimed)
- Ruin type (if present and revealed)
- Resources available (Phase 7)
- No biome legend — tooltip is the only reference

### Unit Selected Panel (bottom center)

- Unit type and status
- Current hex biome
- If MOVING: destination and estimated ticks remaining
- If CLAIMING: progress bar
- Stop button, Deselect button

### City Panel (right drawer)

- City name (player color + tier)
- Tier badge, XP bar to next tier
- Population count
- Production toggle — on/off, ticks to next unit
- Unit count on hex / MAX_UNITS_PER_HEX

### Tick Counter (top right, small)

- Current server tick, updates every 0.1 seconds
- Confirms game loop is live

### Elimination Broadcast (full screen overlay, 4 seconds)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CHANNEL 66  |  VANTARIS TOURNAMENT

  CONTESTANT ELIMINATED

  Commander Vesh

  Survived 1,847 ticks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Flat broadcast tone. 4 second display, then fades. HTML element: `#hud-elimination`.
- Triggered by `playerEliminated` server message
- `gameWon` message also uses this overlay with "WINNER DECLARED" text
- Source: [`frontend/src/ui/HUD.ts`](../frontend/src/ui/HUD.ts) — `checkEliminationOverlay()`, `checkGameWonOverlay()`

### Chat Panel (bottom left)

Source: [`frontend/src/ui/ChatPanel.ts`](../frontend/src/ui/ChatPanel.ts)

```
┌─────────────────────────────┐
│  GLOBAL  │  DIRECT           │
├─────────────────────────────┤
│  [Zara-7] Let's push east   │
│         [Mox-Rin] acknowledged│
│  [Zara-7] Moving now        │
├─────────────────────────────┤
│  Send message...             │
└─────────────────────────────┘
```

- Toggle button: ♦ icon bottom-left (`#hud-chat-toggle`)
- **Global tab**: All-player broadcast messages
- **Direct tab**: DM conversations, sub-tabs per partner
- Unread badges on both global tab and per-DM tabs
- Click ✉ on Player List row to open DM with that player
- 200 character limit, messages trimmed server-side
- Dead players cannot send messages
- ChatMessage type includes `senderColor` for inline name coloring

### Current Rendering Summary

- **Tick counter**: top right (`#hud-tick`)
- **Resource bar**: top center (`#hud-resources`) — food/energy/manpower stockpiles + rates, population, factory count, army size
- **Player List**: top right below tick (`#hud-player-list`)
- **Tooltip**: cursor-following on hover (`#hud-tooltip`) — biome, owner, ruin, resource yield, building
- **Tile panel**: bottom center (`#hud-tile-panel`) — unit/city/tile info, action buttons
- **Elimination overlay**: full-screen centered (`#hud-elimination`)
- **Wordmark**: top center below resource bar (`#hud-wordmark`)
- **Leave button**: top right corner (`#hud-leave`)
- **Chat panel**: bottom left (`#hud-chat`)

### Resource Top Bar

Source: [`frontend/src/ui/HUD.ts`](../frontend/src/ui/HUD.ts)

```
┌─────────────────────────────────────────────────────┐
│  ☘ 50 +3/t  │  ⚡ 30 +2/t  │  ⊕ 20 +2/t  │ ⚑ 42 │ ⚙ 3 │ ⦿ 8 │
└─────────────────────────────────────────────────────┘
```

- Food (green), Energy (blue), Manpower (orange) stockpiles with per-tick rates
- Population count, factory count, army size
- Only shown during active game (`#hud-resources`)
- RAF-throttled, change-detected (hash comparison)