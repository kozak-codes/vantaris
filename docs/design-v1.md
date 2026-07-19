- cant go see view the moon, selene. Selene should also be a sub menu of Vantaris and visible under Planet. All orbital bodies that are direct children of an item should be visible as a sub item. IE we may have System > Vantaris > Selene > future lander
- is the "moon" that we are seeing orbiting vantaris selene? Or just a random legacy object?
- sometimes the topbar dissappears when you click to open a menu  because hover auto opens that menu and then we close it right away. We need some kind of debounce on that?
- The player should start focused on their own lander, not in the system view

- remove the old logic that gave you a city and exposed the tiles around that city - we start from the lander now.
- make the orbital periods a bit quicker, maybe try 10x faster

- commit on a new v1 branch and push

- lander text is too large
- Remove the ruins that spawn on setup
- clicking a tile from the lander should go into the tile view which I think it's doing, but im still focused on the lander. We need to be very easily be able to swap between these tile, planet, spacecraft views.


- in tile view if we zoom out a bit more than a max zoom distance then go back to planet view
- If i go from lander view into a tile view then press <- world then it takes me back to the lander view - it should go to planet view

- Additional UI points: bottom right will be reserved for something. Just above it on the right side, stacked notifications. Bottom left for chat (already there but im not super happy with it)
and left side may be reserved for some stats or something im not sure.
- Opening an item like sun/system view, a planet, a lander, will open a window for it. That window will always open by default on the right side of the screen.
It has three options in its topbar: view, pin, favorite/unfavorite, and close. You can move the windows around as you like. Let's come up with a generic system for those windows.
Favorite will put it in a Favorites topbar item that clicking it will open its window but not open it directly.

- Moving windows is clunky if the window doesnt keep up with the mouse it stops moving.
- Change the pin icon to only have color if its actually pinned, ideally otherwise only show the outline. Same with view.
- Move favorites to the far left of the topbar
- if you move a window, pin it. If a new window is opened, remove all unpinned windows.
- The window content system needs to be super generic - we may have lots of different windows for different buildings, orbital bodies, sub windows, etc with lots of unique settings in them.
What im trying to say here is make sure its not all one big enum.


- remove the initially exposed spawn tiles - the only tiles we will expose are the ones from the lander.
- i cant seem to get to the planet view mode from the lander mode


=== TILE REWORK
- will this handle the some-tiles that aren't hexes?
- hard to click/select tiles now with the new system
- Sometimes. i cant rotate in planet view. Clicking view planet seems to lock on the lander. Something is wrong with this logic...
What does the lander have to do with the planet view? Decouple these if possible.
- clicking a tile should zoom to fully show the whole tile - if you are too zoomed out right now it doesnt select the tile, but it should zoom you to the right spot.

- tiles dont really seem to have any height and are super blurry, they can be more impressive im sure. I can see tile edges, so we need to make sure they are connected in some way so I cant see between
the tiles.
- in the world gen, the larger tile should not dictate what is in that tile - rather, let's have huge worldgen algorithm that basically ignores the macro tiles and just generates the sub hexes
- In tile view, Allow us to move the camera with WASD - if the center of the camera moves into a different tile then our "selected tile" changes.
Basically lets try to keep the planet camera controls as similar as possible to the tile camera controls. Really the only difference of if we are in tile or planet view should be our zoom level
so maybe we want to keep the planet focused overall?
- why do we have "world" view mode? We should try and simplify our logic for looking at a planet and seeing a tile, or looking at a spacecraft around a planet (or moon later on) - lets be DRY here,
but also careful about deliniating planet/tile view versus spacecraft focuses
- remove the concept of "biomes" from our macro tile system. Instead, focus on improving our larger world generation system.
- I am not seeing any oceans anywhere, but oceans are important. The world generation system we previously built should handle oceans (anything less than a certain depth is an ocean)
- We need generally flat spots for building, mountains will just be bad, tundra is OK, you want a nice green spot where you will be able to put farms to sustain your people
- artic circle is a bit too drastic tbh
- tile change flash: when a tile is changed or exposed, while it is rendering it is not shown. Instead, show the old tile instead of showing nothing (IE the old visible tile if going not visible OR
the FOW tile if we are still waiting for that tile to render


- Remove biomes from macro hexes PLEASE - this means removing them from the UI too and all backend references. Im also not seeing an actual "ocean" in this game,
are we still using the terrain generation system that simulated plate tectonics etc?


=== LANDER LAND FUNCTIONALITY TO BUILD BUILDING

- LAND NOW button places the lander on the tile directly below it

- "land" is disabled if you are not on a tile. Show a tooltip or warning that we must be IN a tile and place the lander where we want to land by clicking the land button AFTER you've selected a tile.
This is the first direction that the user may read, and so it needs to tell them what the next step is.

- Clicking land and selecting a location on a tile should place a constructable item - then, the lander should change its orbit so it will be above that tile
- Before placing the lander, it should show the adjustments that we will make in orbit as icons with orbits between them and a final icon for LANDING HERE - each icon is a maneuver point
- The lander must place nodes on its orbit that can trade fuel for orbit changes.
- We must build a system that determines where to place this node and how to get to the desired orbit
- we need a balance of minimal fuel but also not take forever to do
- Once at that node, the change/swap for fuel is instant (not need to simulate a burn or anything - just needs to be in an allowed spot) - larger changes cost more fuel
- Might be nice to have a "change orbit" button on the lander that lets us choose a new orbit somehow (inclindation, altitude, offset - is there a better word for this?)
- Add a node above that tile for "land" which then builds the constructable object (the lander, from the lander that was in orbit)
- This is where the game will begin! You've now selected your starting location, have your lander out, and will then need to start making roads and building buildings from the resources in your lander.
We will get to that though!


- We should fine "ideal" locations to initial place the lander in orbit above - like place it below a nice plains area by default



=== SPAWN
- Still seeing initial extra tiles on spawn

=== UI
- Remove exit icon and change with a settings menu. Last option should be exit game. Menu is a breadcrumb for all the settings and stuff.
- option to always point north up
- Add an admin menu (visible to all players for now) that allows us to "remove FOW" "make all land visible"
