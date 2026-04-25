# Day/Night Cycle

> Phase 6 — Rotating sun, terminator gradient, city glow

## Overview

The day/night cycle is driven by the server tick. The server computes a `sunAngle` from `tick / dayNightCycleTicks` and broadcasts it in every player slice. The client rotates the directional light, modulates ambient intensity, applies a terminator gradient to cell materials, and lights cities on the night side.

## Server

- `GameState.dayNightCycleTicks` — configurable per room (default 600 ticks = 60 seconds at 100ms/tick)
- `GameState.getSunAngle()` — returns `(tick / dayNightCycleTicks) * 2π`
- `PlayerStateSlice.sunAngle` — current sun angle in radians
- `PlayerStateSlice.dayNightCycleTicks` — so client knows the cycle length

## Client

### DayNightRenderer (`frontend/src/systems/DayNightRenderer.ts`)

| Feature | Implementation |
|---------|---------------|
| Rotating sun | DirectionalLight reparented into `sunPivot` Group; `sunPivot.rotation.y = sunAngle` |
| Ambient modulation | `lerp(NIGHT, DAY, dayFactor)` where `dayFactor = 0.5 + 0.5 * cos(sunAngle)` |
| Hemisphere light | Sky/ground light for subtle night-side blue tint |
| Terminator gradient | Dot product of cell normal × sun direction → `smoothstep` → emissive dark tint on night-side cells |
| City glow | `PointLight` per visible city, positioned just above the surface; intensity scales with `1 - dayFactor` |

### Visual Parameters

| Constant | Default | Description |
|----------|---------|-------------|
| `DAY_NIGHT_CYCLE_TICKS` | 600 | Full rotation period (60s at 100ms/tick) |
| `SUN_INTENSITY` | 1.5 | Directional light intensity |
| `AMBIENT_DAY_INTENSITY` | 0.8 | Ambient light at noon |
| `AMBIENT_NIGHT_INTENSITY` | 0.15 | Ambient light at midnight |
| `CITY_GLOW_INTENSITY` | 0.4 | Max point-light intensity per city |
| `CITY_GLOW_COLOR` | `#ffcc44` | Warm yellow city glow |
| `NIGHT_COLOR_MIX` | 0.35 | How strongly the night emissive tints cells |

## Configurable Cycle Length

Room creators can pass `dayNightCycleTicks` in the room creation options. If not provided, defaults to `DAY_NIGHT_CYCLE_TICKS` (600). This allows faster cycles for testing or different game modes.

## HUD

The tick counter shows a ☀ or ☽ icon based on whether `cos(sunAngle)` is positive (day) or negative (night).