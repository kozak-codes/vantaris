# Stages — Phase Tracker

> This document tracks what has been completed in each development phase and what remains. Used as an in-project issue tracker.

## ✅ Phase 1 — Globe Foundation

**Status: COMPLETE**

- [x] Three.js geodesic hex globe (subdivided icosahedron → dual graph)
- [x] Noise-based biome assignment (Ocean, Plains, Forest, Mountain, Desert, Tundra)
- [x] Fog of war test rendering (UNREVEALED → REVEALED → VISIBLE states)
- [x] Camera controls (pointer/touch drag, keyboard, zoom with inertia)
- [x] VANTARIS wordmark

**Key files:**
- [`frontend/src/globe/GlobeRenderer.ts`](../frontend/src/globe/GlobeRenderer.ts)
- [`frontend/src/globe/HexGrid.ts`](../frontend/src/globe/HexGrid.ts)
- [`frontend/src/globe/terrain.ts`](../frontend/src/globe/terrain.ts)
- [`frontend/src/camera/CameraControls.ts`](../frontend/src/camera/CameraControls.ts)
- [`frontend/src/systems/FogOfWar.ts`](../frontend/src/systems/FogOfWar.ts)

---

## ✅ Phase 2 — Colyseus Backend

**Status: COMPLETE**

- [x] Monorepo setup (npm workspaces: frontend, backend, shared)
- [x] LobbyRoom (persistent, broadcasts queue counts)
- [x] MatchmakingRoom (queue, countdown, launch game)
- [x] VantarisRoom (authoritative game room)
- [x] Matchmaking countdown
- [x] URL persistence (`?room=roomId`)
- [x] Reconnection (`allowReconnection`, localStorage)
- [x] Per-player fog slice architecture
- [x] Colyseus 0.16 with `@colyseus/schema`, `@colyseus/ws-transport`

**Key files:**
- [`backend/src/index.ts`](../backend/src/index.ts)
- [`backend/src/rooms/LobbyRoom.ts`](../backend/src/rooms/LobbyRoom.ts)
- [`backend/src/rooms/MatchmakingRoom.ts`](../backend/src/rooms/MatchmakingRoom.ts)
- [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts)
- [`backend/src/mutations/fog.ts`](../backend/src/mutations/fog.ts)
- [`frontend/src/network/ColyseusClient.ts`](../frontend/src/network/ColyseusClient.ts)
- [`frontend/src/network/RoomPersistence.ts`](../frontend/src/network/RoomPersistence.ts)
- [`frontend/src/ui/LobbyUI.ts`](../frontend/src/ui/LobbyUI.ts)

---

## ✅ Phase 3 — Game Tick, Cities, Troops

**Status: COMPLETE**

- [x] Server tick loop at 100ms (10 ticks/second)
- [x] Movement costs scaled 10x (PLAINS=30, FOREST=60, MOUNTAIN=90)
- [x] One city per player on PLAINS hex (with spawn buffer)
- [x] City produces infantry (100 tick production cycle)
- [x] Infantry movement via server-side A* pathfinding
- [x] Ocean impassable
- [x] Fog of war 100% server-authoritative, driven by unit vision
- [x] Smooth unit movement interpolation (clock-driven)
- [x] Auto-claim unclaimed hex on unit arrival
- [x] Claim timers (50 ticks unclaimed, 3000 ticks enemy)
- [x] Cannot claim tiles you already own
- [x] Hover highlights (white/purple/yellow/red)
- [x] Owner-colored hex borders on territory boundaries
- [x] Selection indicator (small white circle for units, hex ring for tiles)
- [x] Number key entity selection (press 1 to select first idle unit)
- [x] Auto-enter move mode when selecting own idle infantry
- [x] Click-tile-with-entity-selected updates context without deselecting
- [x] Vitest testing framework (23 tests across 3 suites)
- [x] Fixed adjacency double-prefix bug (cell_cell_N → cell_N)
- [x] Fixed hover ring persistence (assign return value)
- [x] Fixed HUD click flicker (suppressUpdate flag)
- [x] Fixed raycasting through overlay meshes (raycast = () => {})
- [x] Player List panel (right side — all contestants, alive/dead stats, sorted by territory)
- [x] Hex hover tooltip (biome, owner, fog state — cursor-following)
- [x] Full HUD: unit panel, city panel, tick counter
- [x] Elimination broadcast overlay (Channel 66 style — 4 second fade)
- [x] Elimination detection (no cities = eliminated, all units removed)
- [x] Win detection (last player alive = winner, game phase FINISHED)
- [x] Biome legend removed (tooltip is the only reference per GDD)
- [x] Territory tint rendering with pulse animation (owner color blended 22% into biome, border opacity pulses via sine wave)
- [x] Passive city expansion (Village+ only — cooldown per tier: Settlement=never, Village=120t, Town=60t, City=30t, Metropolis=15t, Megacity=5t)

**Key files:**
- [`backend/src/systems/TickSystem.ts`](../backend/src/systems/TickSystem.ts)
- [`backend/src/systems/Pathfinding.ts`](../backend/src/systems/Pathfinding.ts)
- [`backend/src/mutations/units.ts`](../backend/src/mutations/units.ts)
- [`backend/src/mutations/cities.ts`](../backend/src/mutations/cities.ts)
- [`backend/src/mutations/territory.ts`](../backend/src/mutations/territory.ts)
- [`frontend/src/systems/UnitRenderer.ts`](../frontend/src/systems/UnitRenderer.ts)
- [`frontend/src/systems/CityRenderer.ts`](../frontend/src/systems/CityRenderer.ts)
- [`frontend/src/systems/SelectionRenderer.ts`](../frontend/src/systems/SelectionRenderer.ts)
- [`frontend/src/systems/IconFactory.ts`](../frontend/src/systems/IconFactory.ts)
- [`frontend/src/state/ClientState.ts`](../frontend/src/state/ClientState.ts)
- [`frontend/src/input/GlobeInput.ts`](../frontend/src/input/GlobeInput.ts)
- [`frontend/src/ui/HUD.ts`](../frontend/src/ui/HUD.ts)

---

## ✅ Phase 4 — Chat

**Status: COMPLETE**

- [x] Global game chat (broadcast to all players)
- [x] Direct message chat via Player List (✉ button per player)
- [x] Chat panel UI with Global/Direct tabs
- [x] DM tabs for each conversation partner
- [x] Unread badge counters (global + per-DM)
- [x] Server-side chat message handlers (chatMessage, chatDirect)
- [x] Message length limit (200 chars)
- [x] Dead players cannot send messages
- [x] Chat toggle button (♦ in bottom-left)

**Key files:**
- [`shared/src/types.ts`](../shared/src/types.ts) — ChatMessage interface
- [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts) — handleChatMessage, handleDirectMessage
- [`frontend/src/ui/ChatPanel.ts`](../frontend/src/ui/ChatPanel.ts) — Chat panel UI component
- [`frontend/src/network/ColyseusClient.ts`](../frontend/src/network/ColyseusClient.ts) — sendChatMessage, sendDirectMessage, onChatMessage
- [`frontend/src/state/ClientState.ts`](../frontend/src/state/ClientState.ts) — chatMessages, chatTab, chatUnread*
- [`frontend/src/ui/HUD.ts`](../frontend/src/ui/HUD.ts) — DM button on player list rows
- [`frontend/src/style.css`](../frontend/src/style.css) — Chat panel + DM button styles

---

## ✅ Phase 5 — World Generation & Ruins

**Status: COMPLETE**

- [x] Plate tectonics pipeline replaces noise generation (`backend/src/worldgen/pipeline.ts`)
- [x] Coherent mountain ranges, coastlines, climate zones (convergent/divergent boundaries + elevation)
- [x] Resource yield stubs per hex (Ore/Mountain, Food/Plains, Timber/Forest)
- [x] Ruin placement pass (`backend/src/worldgen/ruins.ts` — ~10% land, 6 ruin types)
- [x] Ruins visible as markers on unrevealed hexes (orbital survey via `RuinMarkerData`)
- [x] Ruin contents revealed on unit entry (auto-reveal on arrival + `ruinRevealed` flag)
- [x] Territory tint + pulse (done in Phase 3)
- [x] Passive city expansion (done in Phase 3)

**Key files:**
- [`backend/src/worldgen/pipeline.ts`](../backend/src/worldgen/pipeline.ts) — Full plate tectonics pipeline
- [`backend/src/worldgen/ruins.ts`](../backend/src/worldgen/ruins.ts) — Ruin placement algorithm
- [`backend/src/worldgen/rng.ts`](../backend/src/worldgen/rng.ts) — Seeded PRNG + vector math
- [`backend/src/globe.ts`](../backend/src/globe.ts) — Updated: calls worldgen pipeline
- [`shared/src/types.ts`](../shared/src/types.ts) — RuinType, ResourceType, BoundaryType, PlateData, RuinMarkerData
- [`backend/src/state/CellState.ts`](../backend/src/state/CellState.ts) — elevation, moisture, temperature, plateId, ruin, resourceType
- [`backend/src/mutations/fog.ts`](../backend/src/mutations/fog.ts) — Passes ruin + resource data in slices, sends ruin markers for unrevealed cells
- [`frontend/src/systems/RuinRenderer.ts`](../frontend/src/systems/RuinRenderer.ts) — Renders ruin markers on globe
- [`docs/plate-tectonics.md`](plate-tectonics.md) — Full pipeline design doc

---

## ✅ Phase 6 — Day/Night Cycle

**Status: COMPLETE**

- [x] Rotating sun (client-side, driven by server tick via `sunAngle`)
- [x] Terminator gradient on cell materials (emissive dark tint on night side)
- [x] City glow on night side (PointLight per visible city, warm yellow)
- [x] Configurable cycle length per room (`dayNightCycleTicks` option, default 600)
- [x] Ambient + hemisphere light modulation (bright day, dim night)
- [x] HUD sun/moon indicator (☀/☽ in tick counter)

**Key files:**
- [`frontend/src/systems/DayNightRenderer.ts`](../frontend/src/systems/DayNightRenderer.ts) — Main renderer
- [`backend/src/state/GameState.ts`](../backend/src/state/GameState.ts) — `dayNightCycleTicks`, `getSunAngle()`
- [`shared/src/constants.ts`](../shared/src/constants.ts) — Cycle tuning constants
- [`shared/src/types.ts`](../shared/src/types.ts) — `PlayerStateSlice.sunAngle`, `dayNightCycleTicks`
- [`frontend/src/state/ClientState.ts`](../frontend/src/state/ClientState.ts) — `sunAngle`, `dayNightCycleTicks`
- [`docs/day-night.md`](day-night.md) — Full design doc

---

## ✅ Phase 7 — Resources & Population

**Status: COMPLETE**

- [x] Food, energy, manpower active
- [x] Passive city expansion (Village+ only) — carried over from Phase 3
- [x] Engineer unit with building + ruin restoration
- [x] Farms, mines, power plants buildable
- [x] Resource top bar that highlights ec, popup of resources stockpiled/generated last 100 ticks, pop, cities, factories, army size, etc
- [x] Population growth/decline loop
- [x] City XP and tier upgrades active
- [x] Resource stockpiles, raidable on capture
- [x] Energy pipeline through contiguous territory

**Key files:**
- [`shared/src/types.ts`](../shared/src/types.ts) — BuildingType (FARM/MINE/POWER_PLANT), BuildingData, PlayerResourceData, UnitType.ENGINEER, UnitStatus.BUILDING
- [`shared/src/constants.ts`](../shared/src/constants.ts) — BUILDING_TICKS, BUILDING_RESOURCE_YIELD, BUILDING_PLACEMENT_RULES, population/XP constants, ENGINEER_PRODUCTION_TICKS
- [`backend/src/state/BuildingState.ts`](../backend/src/state/BuildingState.ts) — Building schema (buildingId, ownerId, cellId, type, productionTicksRemaining)
- [`backend/src/mutations/buildings.ts`](../backend/src/mutations/buildings.ts) — createBuilding, tickBuildingProduction, canPlaceBuilding, removeBuilding
- [`backend/src/mutations/resources.ts`](../backend/src/mutations/resources.ts) — tickResources, tickPopulation, tickCityXP, raidStockpiles, computeCityResourceRates
- [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts) — handleBuildStructure, handleRestoreRuin, processBuildTimers, processResources, processPopulation, processCityXP
- [`frontend/src/systems/BuildingRenderer.ts`](../frontend/src/systems/BuildingRenderer.ts) — Farm/Mine/PowerPlant icons on globe (under construction = dashed)
- [`frontend/src/systems/IconFactory.ts`](../frontend/src/systems/IconFactory.ts) — createEngineerIcon
- [`frontend/src/ui/HUD.ts`](../frontend/src/ui/HUD.ts) — Resource top bar, city panel with XP/pop/resources, engineer build/restore buttons, infantry/engineer production toggle
- [`frontend/src/input/GlobeInput.ts`](../frontend/src/input/GlobeInput.ts) — handleBuildKey, handleRestoreKey
- [`frontend/src/network/ColyseusClient.ts`](../frontend/src/network/ColyseusClient.ts) — sendBuildStructure, sendRestoreRuin
- [`frontend/src/state/ClientState.ts`](../frontend/src/state/ClientState.ts) — buildings map, resources data, 'build'/'restore' command actions
- [`backend/src/__tests__/resources.test.ts`](../backend/src/__tests__/resources.test.ts) — 16 tests: buildings, resources, population, XP, raid, city rates

---

## ⬜ Phase 8 — Factory Supply Chains

**Status: NOT STARTED**

- [ ] Factory recipe assignment + XP system
- [ ] Full supply chain active
- [ ] STARVED state
- [ ] Production queue UI

---

## ⬜ Phase 9 — Traders & Energy Credits

**Status: NOT STARTED**

- [ ] Trader unit (self-trader and broker modes)
- [ ] Trading table UI
- [ ] EC minting from surplus energy
- [ ] Floating exchange rate

---

## ⬜ Phase 10 — Diplomacy

**Status: NOT STARTED**

- [ ] Four alliance tiers
- [ ] Proposals via Player List
- [ ] Reputation system
- [ ] Revolt mechanic

---

## ⬜ Phase 11 — Naval & Terrain Specialization

**Status: NOT STARTED**

- [ ] Navy, cavalry, artillery units
- [ ] Sea lane control
- [ ] River movement bonuses
- [ ] Terrain specialization bonuses

---

## ⬜ Phase 12 — Orbital Layer

**Status: NOT STARTED**

- [ ] Satellite unit (Megacity + massive energy)
- [ ] Satellites orbit globe visually
- [ ] Recon and strike satellite types
- [ ] Spectator mode with Channel 66 broadcast overlay

---

## ⬜ Phase 13 — Multi-Planet

**Status: NOT STARTED**

- [ ] Second planet via orbital transition
- [ ] Inter-planet trader routes
- [ ] Planet-unique resources
- [ ] Victory: control both planets simultaneously