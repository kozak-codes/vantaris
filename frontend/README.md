# Vantaris

A browser-based 3D interactive globe with a hexagonal grid overlay and fog of war system. This is the visual foundation for Vantaris, a strategic RTS game.

## Quick Start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (default: `http://localhost:5173`). Hot reloading is active — any file save will update the browser automatically.

## Controls

- **Click and drag** — Rotate the globe (with momentum/inertia on release)
- **Scroll wheel** — Zoom in/out
- **Pinch (mobile)** — Zoom in/out
- **Click a visible cell** — Expand visibility to adjacent cells

## Project Structure

```
src/
├── main.ts              Entry point — wires all systems together
├── types/
│   └── index.ts          Shared interfaces (CellState, BiomeType, FogState, configs)
├── constants.ts          All tunable constants (subdivision level, biome weights, fog opacity, etc.)
├── globe/
│   ├── GlobeRenderer.ts  Three.js scene construction, cell meshes, borders, atmosphere glow, starfield
│   ├── HexGrid.ts        Geodesic grid generation (subdivided icosahedron → dual graph)
│   └── terrain.ts        Seeded biome assignment with configurable weights
├── systems/
│   └── FogOfWar.ts       Fog state management (Unexplored → Explored → Visible)
├── camera/
│   └── CameraControls.ts Pointer/touch drag rotation with inertia, scroll zoom, pinch zoom
├── debug/
│   └── DebugAPI.ts       Exposed `window.vantaris` object for live debugging
├── ui/
│   └── HUD.ts            HTML/CSS overlay — biome legend, cell tooltip, wordmark
└── style.css             All UI styling
```

## Module Overview

### HexGrid
Generates a geodesic hexagonal grid by subdividing an icosahedron and computing the dual graph. Produces ~12 pentagons (geometrically correct) and ~630 hexagons at subdivision level 3. Each cell tracks its vertex IDs (face centroids from the primal mesh), center position, and adjacency list.

### GlobeRenderer
Creates Three.js meshes for each cell (fan triangulation from cell center to dual vertices), draws cell borders as line segments, and applies fog-of-war colors. Includes stretch goals: atmosphere glow (shader-based fresnel effect) and starfield background.

### FogOfWar
Manages cell fog state transitions. On init, reveals a random cluster of ~7 cells as starting territory and marks their neighbors as Explored. Clicking a Visible cell expands visibility to adjacent cells with animated color transitions.

### CameraControls
Rotates a pivot group (containing the globe) with pointer drag. Applies velocity damping for weighted inertia feel. Scroll zoom with smooth interpolation between min/max limits. Supports touch pinch-to-zoom.

### HUD
Pure HTML/CSS overlays — biome color legend (bottom-left), cell info tooltip on hover (top-right), and "VANTARIS" wordmark (top-center).

### DebugAPI
Exposes `window.vantaris` in the browser console for live debugging. Key commands:
- `vantaris.fog.revealAll()` — reveal the entire globe
- `vantaris.fog.hideAll()` — reset all fog
- `vantaris.fog.revealCell(id)` — expand fog from a cell
- `vantaris.camera.focusCell(id)` — point camera at a cell
- `vantaris.camera.zoom(distance)` — set zoom level (7–25)
- `vantaris.state.cell(id)` — inspect a cell's full state
- `vantaris.state.gridInfo` — grid summary
- `vantaris.state.fps()` — current framerate

## Constants

All tunable values are in `src/constants.ts`:
- **GLOBE_CONFIG** — radius, subdivision level, border width
- **BIOME_CONFIGS** — biome types, display colors, spawn weights
- **FOG_CONFIG** — fog colors, opacity, animation timing, starting territory size
- **CAMERA_CONFIG** — min/max zoom distance, rotation damping, zoom speed

## Future Phases

This Phase 1 delivers the globe, grid, terrain, and fog — no units, combat, diplomacy, resources, or game loop. The module boundaries are designed so future systems can be added without tight coupling to the rendering layer.

## Documentation

- **[docs/AGENTS.md](docs/AGENTS.md)** — Full architecture guide, development workflow, Chrome DevTools debugging, module API reference, constants reference, and self-improving documentation practices.