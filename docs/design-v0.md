# VANTARIS — Game Design Document
**Version 0.4 — Phase 3 In Progress**

---

## Lore

### The Tournament

Channel 66 is a galactic entertainment network — one of the oldest and most-watched broadcasts in the known galaxy, with viewers spanning dozens of star systems and even a handful of foreign galaxies. Every year, Channel 66 hosts the **Vantaris Tournament**: a civilization strategy competition played on a real planet for real stakes.

The planet used for the tournament has no official name in modern records. What is known is that it was once home to an advanced civilization that completely destroyed itself — through war, resource depletion, or something worse. The surface is scarred with the remnants of that lost world: abandoned cities, ruined factories, collapsed ports, forgotten fortifications. Whoever they were, they left behind a planet rich in infrastructure — and in warning.

Channel 66 acquired the planet long ago and has used it as the tournament grounds ever since. Each year, the network's terraforming division resets the planet's biosphere — reseeding forests, refreezing tundra, restoring coastlines — while deliberately leaving the ruins of the old civilization intact. They are part of the spectacle.

**Willing participants** from across the galaxy enter the tournament. Each participant takes control of a Vantari — a small faction that begins with nothing but a single settlement and the ruins of history around them. The tournament runs until a winner is determined.

The stakes are absolute:
- **The winner** receives **1 billion Energy Credits** — generational wealth by any standard
- **Survivors** who are eliminated but not destroyed may live to compete another year
- **The fully eliminated** — those whose civilization is completely destroyed — **do not survive**

The galaxy watches. Billions of viewers tune in to Channel 66 to follow their favorite Vantari, bet on outcomes, and witness the spectacle of civilizations rising and collapsing in real time. Advertisers pay fortunes for commercial placement. Some foreign galaxies receive the broadcast on a delay of several light-years but watch nonetheless.

The tournament has run long enough that the ruins on the surface predate any living viewer's memory. Whether the original civilization destroyed itself in a tournament of their own — or something far worse — is a question Channel 66 has never answered on air.

### Narrative Hooks

- **Ruins as strategic assets** — scattered across the map are remnants of the old civilization: ruined cities, abandoned factories, collapsed ports, overgrown farms. These can be claimed and partially restored by engineers, giving early explorers a significant advantage
- **The Audience** — Channel 66 viewers watch in real time. Future phases could surface viewer sentiment, sponsored mid-game events, or commentary overlays
- **The Reset** — every tournament starts fresh. No persistent territory, no saved advantage. The planet is wiped and rebuilt each year. This justifies why every match is a clean slate
- **The Stakes** — the death mechanic is not arbitrary cruelty — it is the reason the galaxy watches. The tension is real. This should be felt in the UI tone: clinical, broadcast-like, never whimsical

### Tone
The game's UI and language should feel like a **live galactic broadcast**. The lobby is a pre-show. The matchmaking countdown is a broadcast countdown. Elimination messages are delivered in the flat tone of a sports announcer. The VANTARIS wordmark belongs to the tournament, not the player.

---

## Overview

Vantaris is a browser-based real-time strategy game played on a 3D geodesic hex globe. Players start with a single settlement near the ruins of an ancient civilization, expand territory through military units and passive growth, manage supply chains and economies, and engage in layered diplomacy — all on a living, rotating planet broadcast to a galactic audience. The long-term vision includes orbital mechanics, satellites, and multi-planet gameplay.

**Core inspirations:**
- OpenFront / War of Dots — accessible real-time territory control
- Civilization — deep diplomacy, city growth, tech progression through supply chains
- Eve Online — player-driven economy, trader routing, market dynamics
- Factorio — supply chain depth and factory specialization

**Design philosophy:**
- The first 5 minutes should be immediately legible — city, unit, move, claim
- Every system should have emergent depth without explicit tutorials
- Geography should matter — terrain, supply lines, and position should drive strategy
- No arbitrary tech trees — advancement comes from building the right supply chains and growing cities
- The tone is a live broadcast — clinical, high-stakes, never cute

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + TypeScript + Three.js |
| Backend | Colyseus (Node.js) |
| Shared types | `@vantaris/shared` npm workspace |
| Multiplayer state | Colyseus Schema (delta-synced, per-player slices) |
| Dev server | `npm run dev` from monorepo root (concurrently) |
| Future persistence | TBD — player accounts, game history |

**Monorepo structure:**
```
vantaris/
├── frontend/     — Vite + Three.js globe client
├── backend/      — Colyseus game server
└── shared/       — Enums, interfaces, constants, hex adjacency algorithm
```

---

## World

### Globe

- Geodesic hex sphere built from a subdivided icosahedron
- ~12 pentagons among hexagons — geometrically correct, intentional
- Subdivision level configurable per game mode:
  - Quick: level 3 (~500 cells)
  - Standard: level 4 (~2000 cells)
- Each hex has one building slot
- Hex adjacency map computed once on room creation, shared between frontend and backend via `@vantaris/shared`

### Ruins (Phase 5)

The surface is scattered with remnants of the destroyed civilization. Ruins are placed during world generation as a separate pass after biome assignment. They follow the logic of the old civilization — cities near water and plains, factories near mountains and ore deposits, ports on coastlines.

**Ruin types:**

| Ruin | Original Structure | Restoration Cost | Benefit When Claimed |
|---|---|---|---|
| Ruined City | City (Tier 1–2) | Engineer ×1 + Construction Kit | Immediately functional Settlement or Village |
| Ruined Factory | Factory | Engineer ×1 + Metal Bars | Functional factory at Level 1 XP, recipe unset |
| Ruined Port | Trade Post / Naval Port | Engineer ×1 | Functional Trade Post + future naval access |
| Ruined Barracks | Barracks | Engineer ×1 | Functional Barracks with minor production bonus |
| Collapsed Mine | Mine | Engineer ×1 | Functional Mine with higher yield than new |
| Overgrown Farm | Farm | Half cost of new farm | Functional Farm at reduced restoration cost |

**Ruin density:** approximately 8–12% of land hexes. Clustered loosely around former population centers. Ruins are visible to all players regardless of fog — they appear on orbital surveys. However, their contents (restoration cost, yield) are only revealed when a unit enters the hex.

**Strategic role:** Ruins reward early exploration. A player who scouts and claims a Ruined City in the first 60 ticks has a significant advantage. This creates early-game tension — players race to claim the old world's legacy.

### Biome Generation — Plate Tectonics Pipeline (Phase 5)

World generation uses a simplified plate tectonics simulation rather than pure noise, producing coherent geography with emergent mountain ranges, rain shadows, river valleys, and climate zones.

**Pipeline:**

**Step 1 — Tectonic Plates**
Scatter N seed points on sphere (8–20 plates). Voronoi assignment gives each hex a plate. Each plate is either oceanic (sits lower, becomes water) or continental. Plates have drift vectors used to classify boundaries.

**Step 2 — Boundary Classification**
Every hex edge between two plates is a boundary:
- Convergent continental + continental → mountain range
- Convergent continental + oceanic → coastal mountains, subduction zone
- Convergent oceanic + oceanic → deep ocean trench
- Divergent continental → rift valley, inland sea risk
- Divergent oceanic → mid-ocean ridge (minor)
- Transform → fault lines, moderate elevation

**Step 3 — Elevation**
Base elevation from plate type (oceanic = negative, continental = positive). Add elevation modifier based on boundary type and distance. Apply single Simplex noise pass for local variation. Sea level threshold = 0.0 — everything below is ocean.

**Step 4 — Climate**
Latitude bands (tropical → polar) set base temperature. Prevailing winds (eastward) + mountain elevation create rain shadows — west-facing slopes are wet, east-facing are dry. Moisture + temperature → biome assignment.

**Step 5 — Biome Matrix**

| | Cold | Temperate | Warm | Hot |
|---|---|---|---|---|
| High moisture | Tundra | Forest | Jungle* | Rainforest* |
| Med moisture | Tundra | Plains | Savanna* | Plains |
| Low moisture | Ice* | Desert | Desert | Desert |
| High elevation | Mountain | Mountain | Mountain | Mountain |
| Below sea level | Ocean | Ocean | Ocean | Ocean |

*Future biomes — stub as nearest existing for now

**Step 6 — Resource Yields (stub)**
Each hex gets a `resourceYield` derived from terrain. Mountain hexes yield ore. Plains yield food. Forests yield timber. Ocean hexes yield nothing.

**Step 7 — Ruin Placement**
After biome and resource assignment, scatter ruins per logical old-civilization placement rules. City ruins near plains + water. Factory ruins near mountains. Port ruins on coastlines. Mine ruins in mountain hexes with high ore yield.

### Hex Data Model

```typescript
interface HexCell {
  cellId: string
  biome: BiomeType
  elevation: number             // -1.0 to 1.0
  moisture: number              // 0.0 to 1.0
  temperature: number           // 0.0 to 1.0
  plateId: string
  isRiverHex: boolean           // stub — Phase 11
  movementCost: number          // derived from terrain + elevation
  resourceYield: ResourceYield  // stub — Phase 7
  ruin: RuinType | null
  ruinRevealed: boolean         // true once a unit has entered the hex
}
```

### Terrain Passability

| Terrain | Passable | Movement Cost (ticks/hex) |
|---|---|---|
| Plains | Yes | 1 |
| Desert | Yes | 1 |
| Forest | Yes | 2 |
| Mountain | Yes | 3 |
| Tundra | Yes | 2 |
| Ocean | No | ∞ |

---

## Game Modes & Tick Rate

| Mode | Tick Rate | Feel | Day Length |
|---|---|---|---|
| Blitz | 1/20s (50ms) | Pure RTS | 5 min |
| Standard | 1s | Balanced | 30 min |
| Grand Strategy | 5 min/tick | Async Civ-like | 2 hrs |

All game logic is tick-rate-agnostic — movement costs are expressed in ticks, and tick rate determines how fast real time passes. Adding modes requires no logic changes.

**Current implementation:** Standard (1 tick/second).

---

## Fog of War

Three states per player per cell:

| State | Server Sends | Rendering |
|---|---|---|
| VISIBLE | Full live data — biome, owner, units, structures | Full terrain color |
| REVEALED | Frozen snapshot — last known owner, no unit data | Desaturated, 60% dark overlay |
| UNREVEALED | Nothing — cell ID not included in payload | #111111 near-black |

**Rules:**
- Fog is 100% server-authoritative — the client never computes or mutates fog state
- The server computes a per-player state slice every tick and sends only what that player can see
- Enemy units are never visible through fog
- REVEALED cells show data frozen at the moment visibility was lost
- Fog updates are immediate on the same tick that a unit moves
- Ruins are visible as subtle markers on UNREVEALED cells (visible from orbit) but contents unknown until a unit enters

**Vision sources:**
- All hexes owned by a player → VISIBLE
- All hexes within `TROOP_VISION_RANGE` (2) of any owned unit → VISIBLE
- Previously VISIBLE, now out of range → REVEALED (snapshot)
- Never seen → UNREVEALED

---

## Territory & Claiming

### Passive Expansion
Cities radiate cultural influence. Higher tier cities expand faster:

| City Tier | Passive Expansion Rate |
|---|---|
| Settlement | None |
| Village | 1 hex per 120 ticks |
| Town | 1 hex per 60 ticks |
| City | 1 hex per 30 ticks |
| Metropolis | 1 hex per 15 ticks |
| Megacity | 1 hex per 5 ticks |

### Active Claiming (Military)
An infantry unit standing on an unclaimed or enemy hex begins a claim timer:

| Target | Claim Time |
|---|---|
| Unclaimed hex | 5 ticks |
| Enemy hex (uncontested) | 30 ticks |
| Enemy hex (contested) | Timer pauses |

If two players both have units on a hex, the claim timer pauses for both. Last unit standing resumes their claim.

### Territory Rendering (Phase 4)
- Each owned hex receives a 20–30% opacity tint in the owning player's color
- Borders render only on hex edges adjacent to a different owner or unclaimed hex
- Border pulses subtly (slow sine wave on opacity)
- Border is thicker/brighter facing enemy territory than unclaimed land
- No border or tint visible through fog

---

## HUD & UI

### Design Tone
The HUD should feel like a **live broadcast overlay** — clean, clinical, slightly futuristic. Think tournament scoreboard, not a fantasy game UI. The planet is a stage. The players are contestants. Channel 66 is watching.

### Hex Tooltip (hover)
Hovering over any VISIBLE or REVEALED hex shows a small tooltip:
- Biome type and terrain type
- Owner (if claimed)
- Ruin type (if present and revealed)
- Resources available (Phase 7)

No biome legend anywhere in the HUD — the tooltip is the only reference needed.

### Player List (right side panel)
A persistent panel listing all players in the current game:

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
- Eliminated players shown with hollow dot and `[dead]` — remain on list as record
- Clicking another player opens the **Player Action Panel**:
  - Chat — opens direct message thread (Phase 4)
  - Diplomacy — opens diplomacy proposal interface (Phase 10)
  - Profile — territory count, city count, unit count (if visible to you)
  - Declare War / Propose Alliance shortcuts (Phase 10)

All players are always listed even if their territory is not visible to you — name and alive status only, no positional data leaked.

### Unit Selected Panel (bottom center)
- Unit type and status
- Current hex biome
- If MOVING: destination and estimated ticks remaining
- If CLAIMING: progress bar
- Stop button, Deselect button

### City Panel (right drawer)
- City name (player color + tier, e.g. "Blue Settlement")
- Tier badge, XP bar to next tier
- Population count (Phase 7)
- Production toggle — on/off, ticks to next unit
- Unit count on hex / MAX_UNITS_PER_HEX
- Ruin status if present (Phase 5)

### Tick Counter (top right, small)
Current server tick, updates every second. Confirms game loop is live.

### Elimination Broadcast (full screen overlay, 3 seconds)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CHANNEL 66  |  VANTARIS TOURNAMENT

  CONTESTANT ELIMINATED

  Commander Vesh

  Survived 1,847 ticks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
Flat broadcast tone. Brief, then fades.

---

## Chat (Phase 4)

- Direct messages between players via the Player List panel
- Global game chat visible to all players (and notionally to Channel 66's audience)
- Messages tied to the room — no persistence between games
- Spectator chat separate from player chat (Phase 12)

---

## Cities

### Growth Model
```
XP/tick = base_rate × food_satisfaction × energy_satisfaction × happiness_modifier
```

| Source | Effect |
|---|---|
| Population existing | +1 XP per 10 citizens/tick |
| Food fully satisfied | ×1.5 multiplier |
| Energy fully satisfied | ×1.3 multiplier |
| Trade activity nearby | +2 XP per completed trade |
| Under siege | ×0.2 multiplier |

### City Tiers

| Tier | Name | XP Required | Pop Cap | Manpower/tick | Food/tick | Energy/tick | Unlocks |
|---|---|---|---|---|---|---|---|
| 1 | Settlement | 0 | 50 | 2 | 1 | 1 | Basic units |
| 2 | Village | 500 | 150 | 6 | 3 | 2 | Power Plant, Barracks |
| 3 | Town | 1,500 | 400 | 15 | 8 | 5 | Trade Post |
| 4 | City | 4,000 | 1,000 | 35 | 20 | 12 | Factory, Engineers |
| 5 | Metropolis | 10,000 | 3,000 | 90 | 55 | 30 | Advanced units |
| 6 | Megacity | 25,000 | 10,000 | 250 | 150 | 80 | Satellite uplink (Phase 12) |

### Stacking
Two cities stacked on the same hex combine into the next tier, inheriting combined XP. Caps at tier 6. Requires an engineer.

### City Decline

| Condition | Effect |
|---|---|
| Food < 50% for 60 ticks | Population shrinks, XP frozen |
| Food = 0 for 120 ticks | Tier drops by 1, XP loss |
| Energy = 0 for 30 ticks | All production halts |
| Unrest for 180 ticks | Revolt — rebel units spawn (Phase 10) |

### Spawn Rules
- First city always spawns on a PLAINS hex
- Fallback if no plains: Desert → Tundra (warning logged)
- Minimum 2-hex buffer between spawn points
- Spawn hex + 6 immediate neighbors claimed on join

---

## Buildings

### Slot System
Each hex has one building slot. Same-type buildings stack (upgrade tier). Different types combine into hybrids.

### Building Combinations

| Base | Added | Result | Effect |
|---|---|---|---|
| City + City | → | Large City (tier up) | +pop cap, +production |
| City + Barracks | → | Garrison | +unit production, -pop growth |
| City + Farm | → | Agricultural City | +food output |
| City + Factory | → | Industrial City | +manufacturing, +energy cost |
| Mine + Mine | → | Deep Mine | +raw resources |
| Barracks + Barracks | → | Fort | +defense, units heal |
| Defense Post + Defense Post | → | Fortress | Strong passive defense |
| Factory + Factory | → | Industrial Complex | High output, high energy cost |

### Building Unlock Gates

| City Tier | Unlocks |
|---|---|
| 1 | Farm, Mine, Defense Post |
| 2 | Barracks, Power Plant |
| 3 | Trade Post |
| 4 | Factory, Engineer production |
| 5 | Heavy Factory, Advanced units |
| 6 | Phase 12 content |

### Engineers
- Produced at Tier 4+ cities
- 3 uses — consumed on build completion
- Construction takes many ticks (engineer stationary and vulnerable)
- Can build, restore ruins, demolish, repair
- Killing mid-construction wastes the use

---

## Units

### Unit Capacity
Maximum 6 units per hex. Hexes at capacity are impassable (exception: destination hex).

### Movement
- Server-side A* pathfinding
- Click unit → click destination → server computes path
- Movement cost varies by terrain
- Swap mechanic: two units trying to pass each other execute simultaneously on the same tick
- Ocean always impassable for land units

### Unit Types

| Unit | Terrain | Role | Phase |
|---|---|---|---|
| Infantry | Land | General purpose, claiming | 3 |
| Engineer | Land | Construction, ruin restoration | 7 |
| Cavalry | Plains/Desert | High mobility | 11 |
| Artillery | Land (slow) | High attack | 11 |
| Navy | Ocean | Sea lane control | 11 |
| Trader | Land/Sea | Economic, non-combat | 9 |

---

## Resources & Economy

### Resource Flow

| Resource | Type | Source | Transport |
|---|---|---|---|
| Ore | Raw | Mine | Trader unit |
| Food | Raw | Farm | Trader unit |
| Timber | Raw | Forest hex | Trader unit |
| Coal | Raw | Mine | Trader unit |
| Textile | Raw | Farm (fiber) | Trader unit |
| Metal Bars | Processed | Smelter | Trader unit |
| Lumber | Processed | Mill | Trader unit |
| Gunpowder | Processed | Chemical factory | Trader unit |
| Guns | Manufactured | Weapons factory | Trader unit |
| Ammunition | Manufactured | Munitions factory | Trader unit |
| Clothing | Manufactured | Textile factory | Trader unit |
| Construction Kit | Manufactured | Builder factory | Trader unit |
| Energy | Pipeline | Power Plant | Contiguous territory |
| Energy Credits (EC) | Currency | Burned energy | Instant |
| Manpower | Local | City | Not transportable |

### Supply Chain

```
TIER 0 — Raw
Mine → Ore, Coal | Farm → Food, Textile | Forest → Timber
Power Plant → Energy | City → Manpower

TIER 1 — Processed
Ore + Energy → Metal Bars (Smelter)
Timber + Energy → Lumber (Mill)
Fiber + Manpower → Textile (Loom)
Coal + Energy → Gunpowder (Chemical)

TIER 2 — Manufactured
Metal Bars + Manpower + Energy → Guns (Weapons factory)
Metal Bars + Gunpowder → Ammunition (Munitions)
Textile + Manpower → Clothing (Textile factory)
Lumber + Metal Bars → Construction Kit (Builder)
Metal Bars + Energy (high) → Engine Parts (Heavy factory)

TIER 3 — Advanced (Phase 11+)
Engine Parts + Metal Bars → Vehicle
Engine Parts + Gunpowder → Artillery
Engine Parts + Energy (massive) → Satellite components
```

### Energy Credits
- Only cross-player currency
- Minted by burning surplus energy
- Floating exchange rate: more EC minted globally = EC worth less
- All trader transactions settle in EC
- Tournament prize: 1 billion EC to the winner

---

## Factories

### Experience System
XP tracked per recipe independently. Switching recipes loses compounding bonus but preserves XP.

| Level | XP Required | Speed |
|---|---|---|
| 1 | 0 | 1× |
| 2 | 100 | 1.2× |
| 3 | 300 | 1.5× |
| 4 | 700 | 2.0× |
| 5 | 1,500 | 2.8× |
| 6 | 3,500 | 4.0× |

STARVED state when hard inputs run dry — queue and XP preserved, production resumes immediately when supply returns.

---

## Traders

### Two Modes

**Self-Trader** — works for the owning player. Executes against the player's own trading table. Physical resources move between stockpiles.

**Broker Mode** — matches other players' buy/sell orders and takes a cut. Owner's resources do not move — pure profit from geographic position between trading partners.

### Trading Table
```
Resource    | Action | Price  | Qty Limit
────────────┼────────┼────────┼──────────
Ore         | SELL   | 3 EC   | 100
Guns        | BUY    | 5 EC   | 50
Food        | SELL   | 1 EC   | unlimited
```

Traders auto-pause on enemy hex routes, negative margin, or ownership change at destination.

---

## Diplomacy (Phase 10)

| Tier | Name | Enables |
|---|---|---|
| 1 | Trade Agreement | Traders enter each other's territory |
| 2 | Non-Aggression Pact | No attacks, claim timers suspended |
| 3 | Vision Sharing | Shared fog of war |
| 4 | Open Borders | Units pass through freely |

Initiated via Player List → Player Action Panel. Breaking a NAP triggers a reputation penalty visible to all players.

---

## Day/Night Cycle (Phase 6)

Sun position driven entirely client-side from tick count: `angle = (currentTick % dayLengthInTicks) / dayLengthInTicks * 2π`. All clients see the same sun. No server involvement.

- Day: full directional light
- Terminator: golden hour tint
- Night: ambient only + city hex glow (scales with tier)
- Megacities visible as glowing points from the dark side of the planet

---

## Victory Conditions

**Power Score** (default — highest score when game ends):
- Land hexes owned ×1
- City tier sum ×50
- Unit count ×5
- Energy Credits ÷1,000 ×1
- Factory mastered recipes ×20

**Alternative end conditions (selectable per room):**
- Elimination — last city standing wins immediately
- Domination — first to 70% of land hexes wins immediately
- Economic — first to 500,000 EC wins immediately
- Timed — game ends after N ticks, highest Power Score wins

---

## Multiplayer & Server Architecture

### Room Types

**LobbyRoom** — persistent, never auto-disposes. Broadcasts queue counts every 2 seconds.

**MatchmakingRoom** — one per queue type. Countdown launches VantarisRoom, sends all clients the new room ID.

**VantarisRoom** — authoritative game room. 1-second tick. Per-player fog slices only. `allowReconnection(client, 60)`.

### Queue Types

| Queue | Min | Max | Subdivision |
|---|---|---|---|
| Quick | 2 | 4 | 3 |
| Standard | 4 | 8 | 4 |

### URL & Persistence
- Room: `?room=roomId`
- Camera: `#cam=lat,lng,zoom`
- Session: `localStorage` by room ID
- Refresh = seamless reconnect

### Per-Player State Slice
Never broadcast raw GameState. Each player receives per tick:
- `visibleCells` — full live data
- `revealedCells` — frozen snapshots
- `units` — only on visible cells
- `cities` — only on visible cells
- `players` — all players (name + color + alive status always, no positional data for unseen players)
- `currentTick`, `myPlayerId`

---

## Phase Roadmap

### ✅ Phase 1 — Globe Foundation
Three.js geodesic hex globe, noise-based terrain, fog of war test, camera controls, VANTARIS wordmark.

### ✅ Phase 2 — Colyseus Backend
Monorepo, LobbyRoom, MatchmakingRoom, VantarisRoom, matchmaking countdown, URL persistence, reconnection, per-player fog slice architecture.

### 🔄 Phase 3 — Game Tick, Cities, Troops (IN PROGRESS)
- Remove all click-to-reveal test code
- 1-second server tick loop
- One city per player on a PLAINS hex
- City produces infantry every 10 ticks
- Infantry movement via server-side A*
- Ocean impassable
- Fog of war 100% server-authoritative, driven by unit vision
- Player List panel (right side) — all contestants, alive/dead, click to open action panel
- Hex hover tooltip — biome, owner (no biome legend in HUD)
- HUD: unit panel, city panel, tick counter
- Elimination broadcast overlay

### Phase 4 — Territory, Borders & Chat
- Claim timers (5 ticks unclaimed, 30 ticks enemy)
- Territory tint + border rendering with pulse animation
- Passive city expansion (Village+ only)
- Direct message chat via Player List
- Global game chat

### Phase 5 — World Generation & Ruins
- Plate tectonics pipeline replaces noise generation
- Coherent mountain ranges, coastlines, climate zones
- Resource yield stubs per hex
- Ruin placement pass — city, factory, port, barracks, mine, farm ruins
- Ruins visible as markers on unrevealed hexes
- Ruin contents revealed on unit entry

### Phase 6 — Day/Night Cycle
- Rotating sun (client-side, driven by tick)
- Terminator gradient, city glow on night side
- Cycle length configurable per room

### Phase 7 — Resources & Population
- Food, energy, manpower active
- Engineer unit with building + ruin restoration
- Farms, mines, power plants buildable
- Population growth/decline loop
- City XP and tier upgrades active
- Resource stockpiles on hexes, raidable on capture
- Energy pipeline through contiguous territory

### Phase 8 — Factory Supply Chains
- Factory recipe assignment + XP system
- Full supply chain active
- STARVED state
- Production queue UI

### Phase 9 — Traders & Energy Credits
- Trader unit
- Self-trader and broker modes
- Trading table UI
- EC minting from surplus energy
- Floating exchange rate

### Phase 10 — Diplomacy
- Four alliance tiers
- Proposals via Player List
- Reputation system
- Revolt mechanic

### Phase 11 — Naval & Terrain Specialization
- Navy, cavalry, artillery units
- Sea lane control
- River movement bonuses
- Terrain specialization bonuses

### Phase 12 — Orbital Layer
- Satellite unit (Megacity + massive energy)
- Satellites orbit globe visually
- Recon and strike satellite types
- Spectator mode with Channel 66 broadcast overlay

### Phase 13 — Multi-Planet
- Second planet via orbital transition
- Inter-planet trader routes
- Planet-unique resources
- Victory: control both planets simultaneously

---

## Open Design Questions

1. **Tick rate flexibility** — allow players to vote to speed up or slow down ticks mid-game?
2. **Unit combat** — automatic per-tick fighting when sharing a hex, or attacker initiates?
3. **Revolt mechanic** — do rebel units fight for independence or just damage the city?
4. **Map seed rematches** — can players vote to keep a map seed?
5. **Spectator mode** — full visibility or one player's perspective?
6. **Seasonal cycle** — slow season layer on top of day/night affecting farms?
7. **Vision Sharing diplomacy** — real-time shared fog or periodic snapshot?
8. **Trade route visualization** — animated trader path lines on the globe?
9. **Channel 66 mid-game events** — sponsored objectives that temporarily change the game?
10. **Ruin lore** — do ruins have names and fragments of the old civilization's history to discover?
11. **Tournament history** — persistent cross-game leaderboard or fully isolated per game?
12. **Contestant naming** — player-chosen, Channel 66 assigned, or both?

---

*Last updated: v0.4 — Phase 3 in progress*
*Next update: Phase 3 complete — add Phase 4 detail, update roadmap status*