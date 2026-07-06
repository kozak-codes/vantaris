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




=== LANDER LAND FUNCTIONALITY TO BUILD BUILDING
- Add some options as sub options to the lander when shown in the menu (it doesnt have things that can orbit it, BUT it can do stuff.) Add a button called "Land" - it opens a UI that requires us to be in a tile that we want to land in.
Clicking the "land" icon allows us to basically place a building that immeidately spawns. This will be our lander.
- "land" is disabled if you are not on a tile. Show 
- We should fine "ideal" locations to initial place the lander in orbit above - like place it below a nice plains area by default

- Clicking land and selecting a location on a tile should place a constructable item - then, the lander should change its orbit so it will be above that tile
- The lander must place nodes on its orbit that can trade fuel for orbit changes.
- We must build a system that determines where to place this node and how to get to the desired orbit
- we need a balance of minimal fuel but also not take forever to do
- Once at that node, the change/swap for fuel is instant (not need to simulate a burn or anything - just needs to be in an allowed spot) - larger changes cost more fuel
- Might be nice to have a "change orbit" button on the lander that lets us choose a new orbit somehow (inclindation, altitude, offset - is there a better word for this?)
- Add a node above that tile for "land" which then builds the constructable object (the lander, from the lander that was in orbit)
- This is where the game will begin! You've now selected your starting location



=== SPAWN
- Still seeing initial extra tiles on spawn

=== UI
- Remove exit icon and change with a settings menu. Last option should be exit game. Menu is a breadcrumb for all the settings and stuff.
- option to always point north up
