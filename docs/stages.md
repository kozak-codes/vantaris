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

- Change 12

## Food rework

- Start the game with 3 citizens and citizen production in your first city turned OFF.
- Add a health, hunger, and rest bar to citizens.
- A citizen has 1000 ticks of "rest" until they will no longer do work.
- A citizen has 1000 ticks of "hunger" - if they are hungry, they will start to lose health at a rate of 0.1 per tick
- A citizen has 100 health. If they run out of health - they die.
- A citizen has a "home" city
- Cities have 6 homes available for citizens
- If a citizen falls below a certain threshold of food, hunger, or has less than full health they will return back to the city to recharge
- A citizens food will recharge extremely quickly, using "food" in the process
- A citizens rest will recharge quite slowly
- Only once a citizen is fully fed, rested, and full health will they continue
- Farms from still have a base rate - they should not. Farms should only produce if (a) it is daytime on that tile and (b) a citizen is working that farm.

- Allow us to adjust the base wage of a building like a farm. These buildings dont seem to be incentive enough for units to go to them, even when i put the Claim Compensation to 0
- When a citizen consumes food, they should have to PAY for it - we should be able to set the global food rate in the economy tab, defaulting to 1 energy credit per food. They need to have enough money too.
- units should have rest decrease more if their tile is currently night
- Align the HP, hunger, and rest bars so they are all in one column as they are not even with each other right now
- increase rest and hunger requirement by about 1.5x

//--------- COMPLETED UP TO HERE

- When citizens return home I dont think their animation is working properly - it should use the existing path system that works well.

## Trader rework

- Let's update the base stockpile component which we should be using on all buildings so that we can choose a "target" amount that we want at that particular location. We should be using the same component for ALL buildings. Some buildings their inputs/outputs locked to always show but we should be able to add other items there too if we want.
- This target and info about items should be summarized on the building view, but editable in a dialog.
- Each building has a different max stockpile size - cities can hold a lot
- You should be able to customize the min/max price we want to buy/sell for something and I'd like your opinion on an effective way that we can automatically set buy/sell prices on these things
- Based on buy/sell pairings, citizens will evaluate these pairings in your own cities (in the future we may allow trade agreements as well with other players - we'll get to that later) and choose the pairings with the most arbitrage per tick (including current location - start -> end -> back home) - they MUST have enough food on them to make that journey for it to count. Then, since this is a task, the citizen will reserve that task.
- The citizen has a max carry capacity and should only be able to carry what they can hold. (We may change this so traders have more carry capacity)
- This means that the task may only be reserved for a certain amount of units, and instead of reserving the existing task we should make a NEW task with what that unit will be doing and reserve it that way. This should then cause the trade check in a later part of the tick to exclude resources from the request that are reserved as on the way.
- Once we reserve that task, it locks in the price at that amount.
- If a unit has to go home because they go below the rest, food, or health threshold then we should cancel that task and the system should automatically recalculate the unreserved transportation task.
- Can we add a task screen on the left side that we can maximize to list all of the tasks available sorted by amount, whats reserved, and by who


## Tile rework

- Add a "base compensation multiplier" to tiles - so tundra tiles are not rewarded as much as other tiles. Tiles with buildings should be rewarded a bit more too.
- When clicking on an unclaimed tile, allow us to adjust the compensation amount from the default amount
- Let's change this to be one building per tile and infinite units. Autoselect the building on that tile when you click/tap it
- Add an "exploration compensation" to the economy tab - this is useful if you want to expand your knowledge of the world quicker.
- Remove the concept of "population" from cities - remove city base energy usage
- Remove all city starting resources and replace with 100 bread for now

## AI State rework

AI state is getting really large, especially after our trader and rework. Consider some ways we can improve the state system for further expansion

## Factories, supply chains, building

- Remove the concept of a generic factory
- Instead you "order" a building. Your list of orders like buildings (unit upgrades?) etc are on the right hand side
- Click on an empty tile to order a building
- After you order a building, it will create a construction site for that building
- Labor is set at a base wage per tick like other buildings
- The building will probably have resource requirements (except for a small amount of exceptions)
- The required resources will be set as stockpile requests
- The building can only be worked on once all the resources are in the tile (maybe we change this later, but I'm OK with this simplification for now)
- Only one citizen/unit may use a building at a time -- we should consider ways that we can have more efficient units at something take priority with what they choose - maybe there is a priority system for new work based on the level of the worker
- If there is no
- Buildings we can order to start:

a) Logging Camp
b) Farm - requires timber, only works during the day
c) Mine - requires timber + has ongoing need for timber
d) Smithy - requires timber + has onging need for timber

I know we have some other buildings too, but we can leave them as placeholders for now.


## Unit upgrades

- traders can carry more
- laborers (not engineers) can work and construct buildings more efficiently but can no longer claim tiles
- engineers are a required labor amount to construct certain buildings
- farmers can build farms and work at them more efficiently
- Change "wage" to be per unit produced
- Merchant Sailor after trader allows accessing water tiles? Perhaps this requires resources to upgrade?
- Add a unit list in the top right below contestants. Click to focus + go to on the map + follow

- How do we economize upgrades, but still make it the players choice what units will do? EXP based with the player clicking on the upgrade that they want for that unit? Will that not get tedious? Auto upgrade to in demand trade? How do we determine if a trade is in demand?
- Perhaps we must build or establish a "guild" to convert a unit to a new type of unit, and they spend money to learn at that guild. Otherwise, they must earn experience doing other things in order to automatically upgrade to a certain unit type
- OR - citizens have "skills" in something that gets trained into them over doing things that earn them XP like in project zomboid - they can pay to learn about a particular skill at a guild.

## Improving the way new citizens are made

- sex?

---

## War

- Upgrade citizens to infantry units somehow - depending on how we build our unit upgrade system
- Infantry units can push fronts, but must either go back to resupply or setup a resupply route with citizens/traders on the tile that they are defending/attacking from
- If infantry runs out of ammunition, guns, health, etc - then they will retreat
- Different unit types serve different purposes like cavalry, artillery, etc

## Diplomacy

Propose to nearby partners different "treaties":

1) Peace - cant attack each other
2) Trade - Can send civilian units into their border & trade with their buildings
3) Border - Can send military units into their border

These are not levels or tiers but different things you can enable/disable.

Treaties last for X ticks and autorenew unless you explicitly choose not to auto renew

Breaking treaties

- [ ] Four alliance tiers
- [ ] Proposals via Player List
- [ ] Reputation system
- [ ] Revolt mechanic
